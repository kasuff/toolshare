"""
Generischer HTTP-Metrik-Report als PDF (für den "Daten exportieren"-Bereich
der Admin-Seite). Fragt Prometheus über einen Zeitraum ab und rendert die
gleichen Kennzahlen wie der JSON/CSV-Export: Requests/s, Fehlerrate, P95-Latenz.
"""

from __future__ import annotations

import io
import logging
from datetime import datetime

import httpx
import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages

import dora  # nutzt dora.PROMETHEUS_URL + HTTP_TIMEOUT

log = logging.getLogger("dora.metrics_report")

# Gleiche Queries wie der Backend-Export (monitoring.controller.ts).
QUERIES = {
    "Requests / s": "sum(rate(http_requests_total[5m]))",
    "Fehlerrate (%)": 'sum(rate(http_requests_total{status_code=~"5.."}[5m])) '
    "/ sum(rate(http_requests_total[5m])) * 100",
    "P95-Latenz (s)": "histogram_quantile(0.95, sum by (le) "
    "(rate(http_request_duration_seconds_bucket[5m])))",
}

RANGES = {"1h": 3600, "24h": 86400, "7d": 7 * 86400}


def _query_range(query: str, start: float, end: float, step: int):
    url = f"{dora.PROMETHEUS_URL}/api/v1/query_range"
    params = {"query": query, "start": start, "end": end, "step": step}
    with httpx.Client(timeout=dora.HTTP_TIMEOUT) as client:
        resp = client.get(url, params=params)
        resp.raise_for_status()
        result = resp.json().get("data", {}).get("result", [])
    if not result:
        return [], []
    times, values = [], []
    for ts, val in result[0]["values"]:
        times.append(datetime.fromtimestamp(float(ts)))
        try:
            values.append(float(val))
        except ValueError:
            values.append(float("nan"))
    return times, values


def build_metrics_report(range_key: str) -> bytes:
    span = RANGES.get(range_key, 86400)
    end = datetime.now().timestamp()
    start = end - span
    step = 60 if span <= 3600 else 300 if span <= 86400 else 1800

    series = {label: _query_range(q, start, end, step) for label, q in QUERIES.items()}

    buf = io.BytesIO()
    with PdfPages(buf) as pdf:
        fig, axes = plt.subplots(3, 1, figsize=(8.27, 11.69))  # A4 hochkant
        fig.suptitle(f"Toolshare – HTTP-Metriken ({range_key})", fontsize=15, fontweight="bold")
        colors = ["#1f6feb", "#cf222e", "#bc4c00"]
        for ax, (label, (times, values)), color in zip(axes, series.items(), colors):
            if times:
                ax.plot(times, values, color=color, linewidth=1.6)
                ax.fill_between(times, values, color=color, alpha=0.12)
                ax.xaxis.set_major_formatter(mdates.DateFormatter("%d.%m %H:%M"))
            else:
                ax.text(0.5, 0.5, "Keine Daten", ha="center", va="center", color="#999")
            ax.set_title(label, fontsize=11)
            ax.grid(True, alpha=0.3)
            for lbl in ax.get_xticklabels():
                lbl.set_rotation(30)
                lbl.set_fontsize(8)
        fig.text(0.08, 0.02, f"Erstellt: {datetime.now():%Y-%m-%d %H:%M}", fontsize=8, color="#888")
        fig.tight_layout(rect=[0, 0.03, 1, 0.96])
        pdf.savefig(fig)
        plt.close(fig)
    buf.seek(0)
    log.info("Metrik-Report erzeugt (range=%s)", range_key)
    return buf.getvalue()
