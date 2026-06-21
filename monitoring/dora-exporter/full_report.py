"""
Gesamtbericht als PDF: bündelt ALLE Monitoring-Daten der Admin-Seite in einem
Dokument – System (CPU/RAM/Disk), HTTP (Traffic/Fehler/Latenz), Business
(User/Buchungen/Logins) und die vier DORA-Metriken inkl. Wochentrends.

Datenquellen: Prometheus (System/HTTP/Business) + GitLab/Alerts (DORA).
"""

from __future__ import annotations

import io
import logging
from datetime import datetime, timedelta, timezone

import httpx
import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages

import dora
import report  # _weekly_buckets, _fmt_duration

log = logging.getLogger("dora.full_report")

# ── Prometheus-Queries (identisch zum Backend-Overview) ───────────────────────
INSTANT = {
    "cpu": '100 - (avg(irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
    "ram": "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100",
    "disk": '(1 - (node_filesystem_avail_bytes{mountpoint="/",fstype!="rootfs"} '
    '/ node_filesystem_size_bytes{mountpoint="/",fstype!="rootfs"})) * 100',
    "reqPerSec": "sum(rate(http_requests_total[5m]))",
    "errorPct": 'sum(rate(http_requests_total{status_code=~"5.."}[5m])) '
    "/ sum(rate(http_requests_total[5m])) * 100",
    "p95": "histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))",
    "activeUsers": "toolshare_active_users",
    "registrations": "toolshare_user_registrations_total",
    "bookings": "toolshare_bookings_created_total",
    "loginsOk": 'toolshare_user_logins_total{status="success"}',
    "loginsFail": 'toolshare_user_logins_total{status="failed"}',
}


def _instant(query: str):
    url = f"{dora.PROMETHEUS_URL}/api/v1/query"
    with httpx.Client(timeout=dora.HTTP_TIMEOUT) as client:
        resp = client.get(url, params={"query": query})
        resp.raise_for_status()
        result = resp.json().get("data", {}).get("result", [])
    if not result:
        return None
    try:
        v = float(result[0]["value"][1])
        return v if v == v else None  # NaN → None
    except (ValueError, KeyError, IndexError):
        return None


def _range(query: str, start: float, end: float, step: int):
    url = f"{dora.PROMETHEUS_URL}/api/v1/query_range"
    with httpx.Client(timeout=dora.HTTP_TIMEOUT) as client:
        resp = client.get(url, params={"query": query, "start": start, "end": end, "step": step})
        resp.raise_for_status()
        result = resp.json().get("data", {}).get("result", [])
    if not result:
        return [], []
    times, values = [], []
    for ts, val in result[0]["values"]:
        times.append(datetime.fromtimestamp(float(ts)))
        try:
            f = float(val)
            values.append(f if f == f else float("nan"))
        except ValueError:
            values.append(float("nan"))
    return times, values


def _step_for(days: int) -> int:
    if days <= 1:
        return 300
    if days <= 7:
        return 1800
    return 3600


def build_full_report(days: int) -> bytes:
    end_dt = datetime.now(timezone.utc)
    start_dt = end_dt - timedelta(days=days)
    end, start = end_dt.timestamp(), start_dt.timestamp()
    step = _step_for(days)

    # Snapshot (aktuelle Werte) + DORA über das Fenster
    snap = {k: _instant(q) for k, q in INSTANT.items()}
    deployments = dora.fetch_deployments(start_dt, end_dt)
    outages = dora.fetch_outages(start_dt, end_dt)
    m = dora.compute(deployments, outages, days)

    buf = io.BytesIO()
    with PdfPages(buf) as pdf:
        _cover(pdf, start_dt, end_dt, snap, m)
        _section(pdf, "System", step, start, end, [
            ("CPU-Auslastung (%)", INSTANT["cpu"], "#1f6feb"),
            ("RAM-Auslastung (%)", INSTANT["ram"], "#2da44e"),
            ("Festplatte / (%)", INSTANT["disk"], "#bc4c00"),
        ])
        _section(pdf, "HTTP", step, start, end, [
            ("Requests / s", INSTANT["reqPerSec"], "#1f6feb"),
            ("Fehlerrate (%)", INSTANT["errorPct"], "#cf222e"),
            ("P95-Latenz (s)", INSTANT["p95"], "#bc4c00"),
        ])
        _section(pdf, "Business", step, start, end, [
            ("Aktive User", INSTANT["activeUsers"], "#1f6feb"),
            ("Registrierungen (kumuliert)", INSTANT["registrations"], "#2da44e"),
            ("Buchungen (kumuliert)", INSTANT["bookings"], "#8250df"),
        ])
        _dora_trends(pdf, deployments, outages, start_dt, end_dt)
    buf.seek(0)
    log.info("Gesamtbericht erzeugt (%d Tage)", days)
    return buf.getvalue()


def _cover(pdf, start, end, snap, m: dora.DoraMetrics):
    fig = plt.figure(figsize=(8.27, 11.69))
    ax = fig.add_subplot(111)
    ax.axis("off")
    ax.text(0, 1.0, "Toolshare – Gesamtbericht", fontsize=22, fontweight="bold")
    ax.text(0, 0.965, f"Zeitraum: {start.date()} – {end.date()}   ·   erstellt {datetime.now():%Y-%m-%d %H:%M}",
            fontsize=10, color="#555")
    ax.text(0, 0.93, f"DORA-Einordnung: {m.performance_level}", fontsize=13, fontweight="bold", color="#1f6feb")

    def pct(v):
        return "–" if v is None else f"{v:.1f} %"

    def num(v):
        return "–" if v is None else f"{v:.0f}"

    rows = [
        ("System – CPU", pct(snap["cpu"])),
        ("System – RAM", pct(snap["ram"])),
        ("System – Disk /", pct(snap["disk"])),
        ("HTTP – Requests/s", "–" if snap["reqPerSec"] is None else f"{snap['reqPerSec']:.2f}"),
        ("HTTP – Fehlerrate", pct(snap["errorPct"])),
        ("HTTP – P95-Latenz", "–" if snap["p95"] is None else f"{snap['p95'] * 1000:.0f} ms"),
        ("Business – Aktive User", num(snap["activeUsers"])),
        ("Business – Registrierungen", num(snap["registrations"])),
        ("Business – Buchungen", num(snap["bookings"])),
        ("Business – Logins (ok/fehl)", f"{num(snap['loginsOk'])} / {num(snap['loginsFail'])}"),
        ("DORA – Deployment Frequency", f"{m.deployment_frequency_per_day:.2f} / Tag"),
        ("DORA – Lead Time (Median)", report._fmt_duration(m.lead_time_seconds_median)),
        ("DORA – Change Failure Rate",
         "–" if m.change_failure_rate is None else f"{m.change_failure_rate * 100:.1f} %"),
        ("DORA – Time to Restore (Median)", report._fmt_duration(m.time_to_restore_seconds_median)),
    ]
    table = ax.table(
        cellText=[[k, v] for k, v in rows],
        colLabels=["Kennzahl", "Aktuell"],
        colWidths=[0.64, 0.28],
        cellLoc="left",
        loc="upper left",
        bbox=[0, 0.18, 1, 0.70],
    )
    table.auto_set_font_size(False)
    table.set_fontsize(10)
    table.scale(1, 1.45)
    for (r, _c), cell in table.get_celld().items():
        if r == 0:
            cell.set_facecolor("#1f6feb")
            cell.set_text_props(color="white", fontweight="bold")
    ax.text(0, 0.08, "Quellen: Prometheus (System/HTTP/Business) · GitLab-Deployments + "
            f"{dora.OUTAGE_SOURCE} (DORA).", fontsize=8, color="#888")
    pdf.savefig(fig)
    plt.close(fig)


def _section(pdf, title, step, start, end, panels):
    fig, axes = plt.subplots(len(panels), 1, figsize=(8.27, 11.69))
    if len(panels) == 1:
        axes = [axes]
    fig.suptitle(title, fontsize=16, fontweight="bold")
    for ax, (label, query, color) in zip(axes, panels):
        times, values = _range(query, start, end, step)
        if times:
            ax.plot(times, values, color=color, linewidth=1.5)
            ax.fill_between(times, values, color=color, alpha=0.12)
            ax.xaxis.set_major_formatter(mdates.DateFormatter("%d.%m"))
        else:
            ax.text(0.5, 0.5, "Keine Daten", ha="center", va="center", color="#999")
        ax.set_title(label, fontsize=11)
        ax.grid(True, alpha=0.3)
        for lbl in ax.get_xticklabels():
            lbl.set_rotation(30)
            lbl.set_fontsize(8)
    fig.tight_layout(rect=[0, 0, 1, 0.96])
    pdf.savefig(fig)
    plt.close(fig)


def _dora_trends(pdf, deployments, outages, start, end):
    buckets = report._weekly_buckets(start, end)
    labels, freq, lead, cfr, ttr = [], [], [], [], []
    for b_start, b_end in buckets:
        b_days = max((b_end - b_start).total_seconds() / 86400, 1e-9)
        b_dep = [d for d in deployments if b_start <= d.finished_at < b_end]
        b_out = [o for o in outages if b_start <= o.start < b_end]
        bm = dora.compute(b_dep, b_out, b_days)
        labels.append(b_start)
        freq.append(bm.deployment_frequency_per_day)
        lead.append((bm.lead_time_seconds_median or 0) / 3600)
        cfr.append((bm.change_failure_rate or 0) * 100)
        ttr.append((bm.time_to_restore_seconds_median or 0) / 3600)

    fig, axes = plt.subplots(2, 2, figsize=(11.69, 8.27))
    fig.suptitle("DORA-Trends (wöchentlich)", fontsize=16, fontweight="bold")
    panels = [
        (axes[0][0], freq, "Deployment Frequency (pro Tag)", "#2da44e"),
        (axes[0][1], lead, "Lead Time for Changes (Stunden)", "#1f6feb"),
        (axes[1][0], cfr, "Change Failure Rate (%)", "#cf222e"),
        (axes[1][1], ttr, "Time to Restore Service (Stunden)", "#bc4c00"),
    ]
    for ax, values, title, color in panels:
        ax.plot(labels, values, marker="o", color=color, linewidth=2)
        ax.fill_between(labels, values, color=color, alpha=0.12)
        ax.set_title(title, fontsize=11)
        ax.grid(True, alpha=0.3)
        ax.xaxis.set_major_formatter(mdates.DateFormatter("%d.%m"))
        for lbl in ax.get_xticklabels():
            lbl.set_rotation(45)
            lbl.set_fontsize(8)
    fig.tight_layout(rect=[0, 0, 1, 0.95])
    pdf.savefig(fig)
    plt.close(fig)
