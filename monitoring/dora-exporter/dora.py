"""
DORA-Datensammlung für Toolshare (GitLab Free + Prometheus).

Quellen:
  • Deployment Frequency + Lead Time  ← GitLab Deployments-API (Free)
  • Change Failure Rate + Time to Restore ← Ausfall-Episoden

Ausfall-Episoden ("Outages") kommen je nach OUTAGE_SOURCE aus:
  • "prometheus_alerts" (Default, geringster Aufwand): die Feuer-Zeiträume
    kritischer Prometheus-Alerts (z. B. BackendDown, CriticalHttpErrorRate).
    Kein manuelles Markieren nötig.
  • "gitlab_incidents": GitLab-Issues vom Typ "incident" (created/closed).

Alle Zeiten werden in UTC (timezone-aware) gehalten.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from statistics import median
from typing import Optional

import httpx

log = logging.getLogger("dora.collect")


# ──────────────────────────────────────────────────────────────────────────────
# Konfiguration (aus Umgebungsvariablen)
# ──────────────────────────────────────────────────────────────────────────────
def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


GITLAB_URL = _env("GITLAB_URL", "https://gitlab.lrz.de").rstrip("/")
GITLAB_PROJECT = _env("GITLAB_PROJECT")  # z. B. "gruppe/toolshare" oder numerische ID
GITLAB_TOKEN = _env("GITLAB_TOKEN")
GITLAB_PRODUCTION_ENV = _env("GITLAB_PRODUCTION_ENV", "production")

PROMETHEUS_URL = _env("PROMETHEUS_URL", "http://prometheus:9090").rstrip("/")

OUTAGE_SOURCE = _env("OUTAGE_SOURCE", "prometheus_alerts")
OUTAGE_ALERT_SEVERITY = _env("OUTAGE_ALERT_SEVERITY", "critical")

HTTP_TIMEOUT = float(_env("DORA_HTTP_TIMEOUT", "30"))


def _project_path() -> str:
    """URL-encodeter Projekt-Pfad für die GitLab-API."""
    from urllib.parse import quote

    return quote(GITLAB_PROJECT, safe="")


def configured() -> bool:
    return bool(GITLAB_PROJECT and GITLAB_TOKEN)


# ──────────────────────────────────────────────────────────────────────────────
# Datenklassen
# ──────────────────────────────────────────────────────────────────────────────
@dataclass
class Deployment:
    id: int
    finished_at: datetime
    lead_time_seconds: Optional[float]  # None, wenn Commit-Zeitpunkt fehlt
    sha: str


@dataclass
class Outage:
    start: datetime
    end: Optional[datetime]  # None = noch offen
    source: str
    name: str

    @property
    def duration_seconds(self) -> Optional[float]:
        if self.end is None:
            return None
        return (self.end - self.start).total_seconds()

    @property
    def resolved(self) -> bool:
        return self.end is not None

    def key(self) -> str:
        return f"{self.name}:{int(self.start.timestamp())}"


# ──────────────────────────────────────────────────────────────────────────────
# Zeit-Helfer
# ──────────────────────────────────────────────────────────────────────────────
def _parse_iso(value: str) -> datetime:
    """GitLab/ISO-Zeitstempel robust parsen → timezone-aware UTC."""
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


# ──────────────────────────────────────────────────────────────────────────────
# GitLab: Deployments + Lead Time
# ──────────────────────────────────────────────────────────────────────────────
def fetch_deployments(start: datetime, end: datetime) -> list[Deployment]:
    """Erfolgreiche Production-Deployments im Zeitraum [start, end]."""
    if not configured():
        log.warning("GITLAB_PROJECT/GITLAB_TOKEN fehlen – keine Deployments.")
        return []

    headers = {"PRIVATE-TOKEN": GITLAB_TOKEN}
    base = f"{GITLAB_URL}/api/v4/projects/{_project_path()}/deployments"
    params = {
        "environment": GITLAB_PRODUCTION_ENV,
        "status": "success",
        "order_by": "finished_at",
        "sort": "asc",
        "finished_after": start.isoformat(),
        "finished_before": end.isoformat(),
        "per_page": 100,
    }

    out: list[Deployment] = []
    with httpx.Client(timeout=HTTP_TIMEOUT, headers=headers) as client:
        page = 1
        while True:
            params["page"] = page
            resp = client.get(base, params=params)
            resp.raise_for_status()
            batch = resp.json()
            if not batch:
                break
            for d in batch:
                finished = d.get("finished_at") or d.get("created_at")
                if not finished:
                    continue
                finished_dt = _parse_iso(finished)
                lead = _lead_time(d, finished_dt)
                out.append(
                    Deployment(
                        id=d["id"],
                        finished_at=finished_dt,
                        lead_time_seconds=lead,
                        sha=d.get("sha", "") or "",
                    )
                )
            # GitLab liefert X-Next-Page; ohne den Header brechen wir bei <100 ab.
            next_page = resp.headers.get("X-Next-Page", "")
            if not next_page:
                break
            page = int(next_page)

    log.info("GitLab: %d Deployments in [%s, %s]", len(out), start.date(), end.date())
    return out


def _lead_time(deployment: dict, finished_dt: datetime) -> Optional[float]:
    """Lead Time = Deploy-Ende − Commit-Zeitpunkt des deployten Stands.

    Der Commit-Zeitpunkt steckt bereits in der Deployment-Antwort unter
    deployable.commit.created_at – kein zusätzlicher API-Call nötig.
    """
    deployable = deployment.get("deployable") or {}
    commit = deployable.get("commit") or {}
    created = commit.get("created_at") or commit.get("committed_date")
    if not created:
        return None
    try:
        commit_dt = _parse_iso(created)
    except ValueError:
        return None
    delta = (finished_dt - commit_dt).total_seconds()
    return delta if delta >= 0 else None


# ──────────────────────────────────────────────────────────────────────────────
# Ausfälle: Prometheus-Alerts  ODER  GitLab-Incidents
# ──────────────────────────────────────────────────────────────────────────────
def fetch_outages(start: datetime, end: datetime) -> list[Outage]:
    if OUTAGE_SOURCE == "gitlab_incidents":
        return _fetch_outages_gitlab(start, end)
    return _fetch_outages_prometheus(start, end)


def _fetch_outages_prometheus(start: datetime, end: datetime) -> list[Outage]:
    """Feuer-Zeiträume kritischer Alerts aus der ALERTS-Zeitreihe ableiten.

    ALERTS existiert nur, solange ein Alert feuert. Wir fragen einen
    Range-Query ab; zusammenhängende Datenpunkte = eine Ausfall-Episode.
    Überlappende Alerts werden zu einer Episode verschmolzen ("Production kaputt").
    """
    step = 60  # Sekunden – Auflösung der Restore-Zeit
    query = f'max(ALERTS{{alertstate="firing",severity="{OUTAGE_ALERT_SEVERITY}"}})'
    url = f"{PROMETHEUS_URL}/api/v1/query_range"
    params = {
        "query": query,
        "start": start.timestamp(),
        "end": end.timestamp(),
        "step": step,
    }
    with httpx.Client(timeout=HTTP_TIMEOUT) as client:
        resp = client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    result = data.get("data", {}).get("result", [])
    if not result:
        log.info("Prometheus: keine kritischen Alert-Episoden in [%s, %s]",
                 start.date(), end.date())
        return []

    # Alle Zeitstempel, an denen mind. ein kritischer Alert feuerte.
    timestamps = sorted(float(ts) for ts, _ in result[0]["values"])

    outages: list[Outage] = []
    ep_start = timestamps[0]
    prev = timestamps[0]
    gap = step * 2  # Lücke > 2 Schritte ⇒ neue Episode
    for ts in timestamps[1:]:
        if ts - prev > gap:
            outages.append(_episode(ep_start, prev, step, end))
            ep_start = ts
        prev = ts
    outages.append(_episode(ep_start, prev, step, end))

    log.info("Prometheus: %d Ausfall-Episoden in [%s, %s]",
             len(outages), start.date(), end.date())
    return outages


def _episode(start_ts: float, last_ts: float, step: int, window_end: datetime) -> Outage:
    start_dt = datetime.fromtimestamp(start_ts, tz=timezone.utc)
    # Episode gilt als beendet, wenn das letzte Sample mehr als 1 Schritt vor
    # dem Abfrage-Ende liegt; sonst feuert der Alert evtl. noch (offen).
    end_dt: Optional[datetime] = datetime.fromtimestamp(last_ts + step, tz=timezone.utc)
    if window_end.timestamp() - last_ts <= step * 1.5:
        end_dt = None  # läuft vermutlich noch
    return Outage(start=start_dt, end=end_dt, source="prometheus_alerts", name="critical-alert")


def _fetch_outages_gitlab(start: datetime, end: datetime) -> list[Outage]:
    """GitLab-Incident-Issues als Ausfälle (created_at → closed_at)."""
    if not configured():
        return []
    headers = {"PRIVATE-TOKEN": GITLAB_TOKEN}
    base = f"{GITLAB_URL}/api/v4/projects/{_project_path()}/issues"
    params = {
        "issue_type": "incident",
        "created_after": start.isoformat(),
        "created_before": end.isoformat(),
        "per_page": 100,
        "scope": "all",
    }
    out: list[Outage] = []
    with httpx.Client(timeout=HTTP_TIMEOUT, headers=headers) as client:
        page = 1
        while True:
            params["page"] = page
            resp = client.get(base, params=params)
            resp.raise_for_status()
            batch = resp.json()
            if not batch:
                break
            for issue in batch:
                created = _parse_iso(issue["created_at"])
                closed = _parse_iso(issue["closed_at"]) if issue.get("closed_at") else None
                out.append(
                    Outage(start=created, end=closed, source="gitlab_incidents",
                           name=f"incident-{issue['iid']}")
                )
            next_page = resp.headers.get("X-Next-Page", "")
            if not next_page:
                break
            page = int(next_page)
    log.info("GitLab: %d Incidents in [%s, %s]", len(out), start.date(), end.date())
    return out


# ──────────────────────────────────────────────────────────────────────────────
# Metrik-Berechnung
# ──────────────────────────────────────────────────────────────────────────────
@dataclass
class DoraMetrics:
    window_days: int
    deployments: int
    deployment_frequency_per_day: float
    lead_time_seconds_median: Optional[float]
    failures: int
    change_failure_rate: Optional[float]  # 0..1
    time_to_restore_seconds_median: Optional[float]
    performance_level: str  # Elite / High / Medium / Low


def compute(deployments: list[Deployment], outages: list[Outage], window_days: int) -> DoraMetrics:
    n_dep = len(deployments)
    freq = n_dep / window_days if window_days else 0.0

    lead_values = [d.lead_time_seconds for d in deployments if d.lead_time_seconds is not None]
    lead_median = median(lead_values) if lead_values else None

    n_fail = len(outages)
    cfr = (n_fail / n_dep) if n_dep else None

    restore_values = [o.duration_seconds for o in outages if o.resolved]
    ttr_median = median(restore_values) if restore_values else None

    return DoraMetrics(
        window_days=window_days,
        deployments=n_dep,
        deployment_frequency_per_day=freq,
        lead_time_seconds_median=lead_median,
        failures=n_fail,
        change_failure_rate=cfr,
        time_to_restore_seconds_median=ttr_median,
        performance_level=_classify(freq, lead_median, cfr, ttr_median),
    )


def _classify(freq_per_day, lead_s, cfr, ttr_s) -> str:
    """Grobe DORA-Einordnung (vereinfachte Schwellen aus dem State-of-DevOps-Report)."""
    score = 0
    checks = 0

    if freq_per_day is not None:
        checks += 1
        score += 3 if freq_per_day >= 1 else 2 if freq_per_day >= 1 / 7 else 1
    if lead_s is not None:
        checks += 1
        score += 3 if lead_s < 86400 else 2 if lead_s < 7 * 86400 else 1
    if cfr is not None:
        checks += 1
        score += 3 if cfr <= 0.15 else 2 if cfr <= 0.30 else 1
    if ttr_s is not None:
        checks += 1
        score += 3 if ttr_s < 3600 else 2 if ttr_s < 86400 else 1

    if not checks:
        return "unbekannt"
    avg = score / checks
    return "Elite" if avg >= 2.75 else "High" if avg >= 2.0 else "Medium" if avg >= 1.5 else "Low"
