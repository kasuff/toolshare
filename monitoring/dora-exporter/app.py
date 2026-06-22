"""
DORA-Exporter für Toolshare.

Endpunkte:
  GET /metrics      → Prometheus-Scrape (DORA-Gauges + Counter)
  GET /report.pdf   → PDF-Report on demand  (?days=90)
  GET /health       → Healthcheck

Ein Hintergrund-Thread berechnet alle COLLECT_INTERVAL_SECONDS die Metriken
über das rollierende Fenster (DORA_WINDOW_DAYS) neu und pflegt zusätzlich
monotone Counter (in einer State-Datei persistiert), damit Grafana per
increase() beliebige Zeitfenster über die Historie bilden kann.
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.responses import Response
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Gauge,
    generate_latest,
)

import dora
import full_report
import metrics_report
import report

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("dora.app")

WINDOW_DAYS = int(os.environ.get("DORA_WINDOW_DAYS", "30"))
COLLECT_INTERVAL = int(os.environ.get("COLLECT_INTERVAL_SECONDS", "300"))
STATE_PATH = Path(os.environ.get("DORA_STATE_PATH", "/data/state.json"))

# ──────────────────────────────────────────────────────────────────────────────
# Prometheus-Metriken
# ──────────────────────────────────────────────────────────────────────────────
# Rollierende Fenster-Gauges (direkt plotbar "over time")
g_freq = Gauge("dora_deployment_frequency_per_day", "Deployments pro Tag (rollierendes Fenster)")
g_lead = Gauge("dora_lead_time_seconds", "Lead Time for Changes, Median (Sekunden)")
g_cfr = Gauge("dora_change_failure_rate", "Change Failure Rate (0..1, rollierendes Fenster)")
g_ttr = Gauge("dora_time_to_restore_seconds", "Time to Restore Service, Median (Sekunden)")
g_window = Gauge("dora_window_days", "Größe des rollierenden Fensters in Tagen")
g_dep_win = Gauge("dora_deployments_window", "Deployments im rollierenden Fenster")
g_fail_win = Gauge("dora_failures_window", "Ausfälle im rollierenden Fenster")
g_last_run = Gauge("dora_last_collect_timestamp_seconds", "Unix-Zeit der letzten erfolgreichen Sammlung")

# Monotone Counter (für increase() über beliebige Zeitfenster in Grafana)
c_deploy = Counter("dora_deployments", "Production-Deployments (kumuliert)")
c_fail = Counter("dora_failures", "Ausfall-Episoden (kumuliert)")
c_restore_sum = Counter("dora_restore_seconds", "Summe der Restore-Dauern (Sekunden, kumuliert)")
c_restored = Counter("dora_restored_incidents", "Behobene Ausfälle (kumuliert)")
c_errors = Counter("dora_collect_errors", "Fehler beim Sammeln (kumuliert)")

g_window.set(WINDOW_DAYS)

# ──────────────────────────────────────────────────────────────────────────────
# Persistenter State für die Counter (überlebt Neustarts → keine Resets)
# ──────────────────────────────────────────────────────────────────────────────
_state_lock = threading.Lock()
_state = {
    "seen_deployments": [],   # Deployment-IDs, die bereits gezählt wurden
    "counted_outages": [],    # Outage-Keys, die bereits als behoben gezählt wurden
}


def _load_state() -> None:
    global _state
    try:
        if STATE_PATH.exists():
            _state = json.loads(STATE_PATH.read_text())
            # Counter auf den persistierten Stand heben, damit increase() stimmt.
            c_deploy.inc(len(_state.get("seen_deployments", [])))
            log.info("State geladen: %d Deployments, %d Ausfälle vorgemerkt.",
                     len(_state.get("seen_deployments", [])),
                     len(_state.get("counted_outages", [])))
    except Exception as exc:  # noqa: BLE001
        log.warning("State konnte nicht geladen werden: %s", exc)


def _save_state() -> None:
    try:
        STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        # Sets begrenzen, damit die Datei nicht unbegrenzt wächst.
        _state["seen_deployments"] = _state["seen_deployments"][-5000:]
        _state["counted_outages"] = _state["counted_outages"][-5000:]
        STATE_PATH.write_text(json.dumps(_state))
    except Exception as exc:  # noqa: BLE001
        log.warning("State konnte nicht gespeichert werden: %s", exc)


# ──────────────────────────────────────────────────────────────────────────────
# Sammel-Durchlauf
# ──────────────────────────────────────────────────────────────────────────────
def collect_once() -> None:
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=WINDOW_DAYS)

    deployments = dora.fetch_deployments(start, end)
    outages = dora.fetch_outages(start, end)
    m = dora.compute(deployments, outages, WINDOW_DAYS)

    # Fenster-Gauges
    g_freq.set(m.deployment_frequency_per_day)
    g_cfr.set(m.change_failure_rate if m.change_failure_rate is not None else float("nan"))
    g_lead.set(m.lead_time_seconds_median if m.lead_time_seconds_median is not None else float("nan"))
    g_ttr.set(m.time_to_restore_seconds_median if m.time_to_restore_seconds_median is not None else float("nan"))
    g_dep_win.set(m.deployments)
    g_fail_win.set(m.failures)

    # Monotone Counter aus neuen Ereignissen fortschreiben
    with _state_lock:
        seen_dep = set(_state["seen_deployments"])
        new_dep = [d.id for d in deployments if d.id not in seen_dep]
        if new_dep:
            c_deploy.inc(len(new_dep))
            _state["seen_deployments"].extend(new_dep)

        counted = set(_state["counted_outages"])
        for o in outages:
            if o.resolved and o.key() not in counted:
                c_fail.inc()
                c_restored.inc()
                c_restore_sum.inc(o.duration_seconds or 0)
                _state["counted_outages"].append(o.key())
        _save_state()

    g_last_run.set(end.timestamp())
    log.info("Sammlung ok: freq=%.2f/d  lead=%s  cfr=%s  ttr=%s  (%s)",
             m.deployment_frequency_per_day,
             _h(m.lead_time_seconds_median), _pct(m.change_failure_rate),
             _h(m.time_to_restore_seconds_median), m.performance_level)


def _h(s):
    return "–" if s is None else f"{s / 3600:.1f}h"


def _pct(v):
    return "–" if v is None else f"{v * 100:.1f}%"


def _loop() -> None:
    _load_state()
    while True:
        try:
            if dora.configured():
                collect_once()
            else:
                log.warning("Nicht konfiguriert (GITLAB_PROJECT/GITLAB_TOKEN) – Sammlung übersprungen.")
        except Exception as exc:  # noqa: BLE001
            c_errors.inc()
            log.exception("Sammlung fehlgeschlagen: %s", exc)
        time.sleep(COLLECT_INTERVAL)


# ──────────────────────────────────────────────────────────────────────────────
# HTTP-App
# ──────────────────────────────────────────────────────────────────────────────
app = FastAPI(title="Toolshare DORA Exporter")


@app.on_event("startup")
def _startup() -> None:
    threading.Thread(target=_loop, daemon=True, name="dora-collector").start()


@app.get("/health")
def health():
    return {"status": "ok", "configured": dora.configured(), "outage_source": dora.OUTAGE_SOURCE}


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/report.pdf")
def report_pdf(days: int = Query(90, ge=1, le=730)):
    pdf = report.build_report(days)
    filename = f"toolshare-dora-{datetime.now():%Y%m%d}-{days}d.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/full-report.pdf")
def full_report_pdf(days: int = Query(30, ge=1, le=730)):
    pdf = full_report.build_full_report(days)
    filename = f"toolshare-gesamtbericht-{datetime.now():%Y%m%d}-{days}d.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/metrics-report.pdf")
def metrics_report_pdf(range: str = Query("24h")):
    pdf = metrics_report.build_metrics_report(range)
    filename = f"toolshare-metrics-{range}-{datetime.now():%Y%m%d}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
