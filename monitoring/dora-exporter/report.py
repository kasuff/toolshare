"""
PDF-Export der DORA-Metriken über die Zeit.

Erzeugt einen mehrseitigen Report:
  • Deckblatt mit Kennzahlen-Übersicht + DORA-Einordnung
  • Vier Trend-Charts (wöchentlich gebucketed): Deployment Frequency,
    Lead Time, Change Failure Rate, Time to Restore

Die Daten werden direkt aus den Quellen (GitLab + Prometheus) für den
angeforderten Zeitraum neu berechnet – der Report ist damit auch direkt
nach dem ersten Start vollständig und unabhängig von der Scrape-Historie.
"""

from __future__ import annotations

import io
import logging
from datetime import datetime, timedelta, timezone

import matplotlib

matplotlib.use("Agg")  # Headless – kein Display nötig
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages

import dora

log = logging.getLogger("dora.report")


def _fmt_duration(seconds) -> str:
    if seconds is None:
        return "–"
    if seconds < 60:
        return f"{seconds:.0f} s"
    if seconds < 3600:
        return f"{seconds / 60:.0f} min"
    if seconds < 86400:
        return f"{seconds / 3600:.1f} h"
    return f"{seconds / 86400:.1f} d"


def _weekly_buckets(start: datetime, end: datetime):
    """Liste von (bucket_start, bucket_end) in Wochenschritten."""
    buckets = []
    cur = start
    while cur < end:
        nxt = min(cur + timedelta(days=7), end)
        buckets.append((cur, nxt))
        cur = nxt
    return buckets


def build_report(days: int) -> bytes:
    """Erzeugt den PDF-Report für die letzten `days` Tage und gibt die Bytes zurück."""
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)

    # Gesamtzeitraum für die Übersicht …
    deployments = dora.fetch_deployments(start, end)
    outages = dora.fetch_outages(start, end)
    overall = dora.compute(deployments, outages, window_days=days)

    # … und wöchentliche Buckets für die Trends.
    buckets = _weekly_buckets(start, end)
    labels, freq, lead, cfr, ttr = [], [], [], [], []
    for b_start, b_end in buckets:
        b_days = max((b_end - b_start).total_seconds() / 86400, 1e-9)
        b_dep = [d for d in deployments if b_start <= d.finished_at < b_end]
        b_out = [o for o in outages if b_start <= o.start < b_end]
        m = dora.compute(b_dep, b_out, window_days=b_days)
        labels.append(b_start)
        freq.append(m.deployment_frequency_per_day)
        lead.append((m.lead_time_seconds_median or 0) / 3600)  # Stunden
        cfr.append((m.change_failure_rate or 0) * 100)  # Prozent
        ttr.append((m.time_to_restore_seconds_median or 0) / 3600)  # Stunden

    buf = io.BytesIO()
    with PdfPages(buf) as pdf:
        _cover_page(pdf, start, end, overall)
        _trend_page(pdf, labels, freq, lead, cfr, ttr)
    buf.seek(0)
    log.info("PDF-Report erzeugt (%d Tage, %d Deployments, %d Ausfälle)",
             days, overall.deployments, overall.failures)
    return buf.getvalue()


def _cover_page(pdf, start, end, m: dora.DoraMetrics):
    fig = plt.figure(figsize=(8.27, 11.69))  # A4 hochkant
    fig.subplots_adjust(left=0.08, right=0.92, top=0.92, bottom=0.08)
    ax = fig.add_subplot(111)
    ax.axis("off")

    ax.text(0, 1.0, "Toolshare – DORA-Metriken", fontsize=22, fontweight="bold")
    ax.text(0, 0.96,
            f"Zeitraum: {start.date()} – {end.date()}   ·   erstellt {datetime.now():%Y-%m-%d %H:%M}",
            fontsize=10, color="#555")
    ax.text(0, 0.91, f"Gesamteinordnung: {m.performance_level}",
            fontsize=14, fontweight="bold", color="#1f6feb")

    rows = [
        ("Deployment Frequency", f"{m.deployment_frequency_per_day:.2f} / Tag"),
        ("Deployments gesamt", f"{m.deployments}"),
        ("Lead Time for Changes (Median)", _fmt_duration(m.lead_time_seconds_median)),
        ("Change Failure Rate",
         "–" if m.change_failure_rate is None else f"{m.change_failure_rate * 100:.1f} %"),
        ("Ausfälle gesamt", f"{m.failures}"),
        ("Time to Restore Service (Median)", _fmt_duration(m.time_to_restore_seconds_median)),
    ]
    table = ax.table(
        cellText=[[k, v] for k, v in rows],
        colLabels=["Kennzahl", "Wert"],
        colWidths=[0.62, 0.30],
        cellLoc="left",
        loc="upper left",
        bbox=[0, 0.45, 1, 0.40],
    )
    table.auto_set_font_size(False)
    table.set_fontsize(11)
    table.scale(1, 1.6)
    for (r, _c), cell in table.get_celld().items():
        if r == 0:
            cell.set_facecolor("#1f6feb")
            cell.set_text_props(color="white", fontweight="bold")

    ax.text(0, 0.06,
            "Quellen: GitLab Deployments-API (Frequency, Lead Time) · "
            f"Ausfälle aus {dora.OUTAGE_SOURCE}.",
            fontsize=8, color="#888")
    pdf.savefig(fig)
    plt.close(fig)


def _trend_page(pdf, labels, freq, lead, cfr, ttr):
    fig, axes = plt.subplots(2, 2, figsize=(11.69, 8.27))  # A4 quer
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
