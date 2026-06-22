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
import math
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
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

# Nur diese Alertnamen gelten als echte Availability-Ausfälle (zählen für CFR und
# Time-to-Restore). Damit werden dauerhaft feuernde Infra-/Kapazitäts-Alerts wie
# DiskSpaceCritical ausgeschlossen, die keinen Deployment-Ausfall darstellen.
# Komma-Liste; leer = keine Filterung (alle kritischen Alerts).
OUTAGE_ALERTNAMES = _env("OUTAGE_ALERTNAMES", "BackendDown,InstanceDown")

# Korrelationsfenster: Ein Deployment gilt als "failed", wenn innerhalb dieser
# Zeit nach dem Deploy-Ende ein Ausfall beginnt (DORA Change Failure Rate).
FAILURE_CORRELATION_SECONDS = float(_env("DORA_FAILURE_CORRELATION_HOURS", "2")) * 3600

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

        # Echte DORA-Lead-Time: pro Deployment den ältesten Commit nehmen, der seit
        # dem vorherigen Deployment neu dazukam (statt nur des deployten HEAD-Commits).
        _assign_dora_lead_times(out, client)

    log.info("GitLab: %d Deployments in [%s, %s]", len(out), start.date(), end.date())
    return out


def _lead_time(deployment: dict, finished_dt: datetime) -> Optional[float]:
    """Fallback-Lead-Time = Deploy-Ende − Commit-Zeitpunkt des deployten HEAD-Stands.

    Wird genutzt, solange die echte DORA-Lead-Time (ältester neu deployter Commit)
    nicht bestimmbar ist – z. B. für das erste Deployment im Fenster (kein Vorgänger)
    oder wenn der GitLab-Compare-Call fehlschlägt. Der Commit-Zeitpunkt steckt bereits
    in der Deployment-Antwort unter deployable.commit.created_at (kein Extra-Call).
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


def _assign_dora_lead_times(deployments: list[Deployment], client: httpx.Client) -> None:
    """Setzt lead_time_seconds = Deploy-Ende − ältester neu deployter Commit.

    DORA definiert Lead Time for Changes als Zeit vom Commit einer Änderung bis zu
    deren Auslieferung in Produktion. Wir bestimmen pro Deployment die Commits, die
    gegenüber dem vorherigen Deployment hinzukamen (GitLab Compare-API), und nehmen
    den ältesten davon. Bei fehlendem Vorgänger/Fehler bleibt der Fallback aus
    _lead_time() (HEAD-Commit-Alter) erhalten.
    """
    for i, dep in enumerate(deployments):
        if i == 0 or not dep.sha:
            continue  # kein Vorgänger → Fallback behalten
        prev_sha = deployments[i - 1].sha
        if not prev_sha or prev_sha == dep.sha:
            continue
        try:
            commit_times = _commits_between(client, prev_sha, dep.sha)
        except Exception as exc:  # noqa: BLE001
            log.warning("Compare %s..%s fehlgeschlagen, nutze Fallback-Lead-Time: %s",
                        prev_sha[:8], dep.sha[:8], exc)
            continue
        if not commit_times:
            continue  # keine neuen Commits → Fallback behalten
        delta = (dep.finished_at - min(commit_times)).total_seconds()
        if delta >= 0:
            dep.lead_time_seconds = delta


def _commits_between(client: httpx.Client, from_sha: str, to_sha: str) -> list[datetime]:
    """Commit-Zeitpunkte der Commits, die in to_sha, aber nicht in from_sha enthalten sind."""
    url = f"{GITLAB_URL}/api/v4/projects/{_project_path()}/repository/compare"
    resp = client.get(url, params={"from": from_sha, "to": to_sha})
    resp.raise_for_status()
    times: list[datetime] = []
    for c in resp.json().get("commits", []):
        created = c.get("created_at") or c.get("committed_date")
        if not created:
            continue
        try:
            times.append(_parse_iso(created))
        except ValueError:
            continue
    return times


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
    # Prometheus lehnt query_range mit > 11.000 Punkten je Zeitreihe per HTTP 400
    # ab. Bei 60-s-Auflösung wird das schon ab ~7,6 Tagen Fenster überschritten,
    # deshalb die Schrittweite so vergröbern, dass wir unter dem Limit bleiben
    # (mit Sicherheitsabstand auf 10.000 Punkte). Kurze Fenster behalten 60 s.
    MAX_POINTS = 10_000
    span_seconds = max(end.timestamp() - start.timestamp(), 1)
    step = max(60, math.ceil(span_seconds / MAX_POINTS))
    names = [n.strip() for n in OUTAGE_ALERTNAMES.split(",") if n.strip()]
    name_filter = f',alertname=~"{"|".join(names)}"' if names else ""
    query = f'max(ALERTS{{alertstate="firing",severity="{OUTAGE_ALERT_SEVERITY}"{name_filter}}})'
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
    # Change Failure Rate (DORA): Anteil der Deployments, denen innerhalb des
    # Korrelationsfensters ein Ausfall folgte. Dadurch ist jeder gezählte Fehler
    # genau einem Deployment zugeordnet und der Wert liegt per Konstruktion in
    # [0, 1] – kein künstliches Deckeln nötig.
    horizon = timedelta(seconds=FAILURE_CORRELATION_SECONDS)
    failed_deploys = sum(
        1
        for d in deployments
        if any(d.finished_at <= o.start <= d.finished_at + horizon for o in outages)
    )
    cfr = (failed_deploys / n_dep) if n_dep else None

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
