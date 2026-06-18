import { useCallback, useEffect, useRef, useState } from "react";
import { Surface } from "./ui";
import {
  type ExportFormat,
  type ExportRange,
  type LogEntry,
  type MonitoringOverview,
  GRAFANA_URL,
  grafanaDashboardUrl,
  grafanaPanelUrl,
  monitoringApi
} from "../services/monitoringApi";

type Props = { token: string };
type Tab = "overview" | "system" | "application" | "logs";

// ── SVG Sparkline ─────────────────────────────────────────────────────────────

function Sparkline({
  data,
  color = "var(--color-brand)",
  height = 52
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  if (data.length < 2) {
    return <div style={{ height }} className="sparkline-empty" />;
  }
  const W = 200;
  const H = height;
  const PAD = 4;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (W - PAD * 2) + PAD;
    const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
    return [x, y] as [number, number];
  });

  const linePath = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const fillPath =
    `M${pts[0][0].toFixed(1)},${H - PAD} ` +
    pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(" ") +
    ` L${pts[pts.length - 1][0].toFixed(1)},${H - PAD} Z`;

  const gradId = `sg${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height, display: "block" }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* Last point dot */}
      <circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r="2.5"
        fill={color}
      />
    </svg>
  );
}

// ── Circular Gauge ────────────────────────────────────────────────────────────

function CircularGauge({
  value,
  label
}: {
  value: number | null;
  label: string;
}) {
  const pct = Math.min(100, Math.max(0, value ?? 0));
  const R = 15.9;
  const circ = 2 * Math.PI * R;
  const dash = (pct / 100) * circ;
  const tone =
    value == null ? "" : pct >= 85 ? "danger" : pct >= 70 ? "warning" : "success";

  const displayColor =
    value == null
      ? "#E5E7EB"
      : pct >= 85
      ? "var(--color-danger)"
      : pct >= 70
      ? "#d97706"
      : "var(--color-success)";

  return (
    <div className="gauge-card">
      <svg viewBox="0 0 36 36" className="gauge-svg" aria-hidden="true">
        {/* Track */}
        <circle cx="18" cy="18" r={R} fill="none" stroke="#E5E7EB" strokeWidth="3" />
        {/* Value arc */}
        <circle
          cx="18"
          cy="18"
          r={R}
          fill="none"
          stroke={value == null ? "#E5E7EB" : displayColor}
          strokeWidth="3"
          strokeDasharray={`${dash.toFixed(2)} ${(circ - dash).toFixed(2)}`}
          strokeDashoffset={(circ * 0.25).toFixed(2)}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
        <text x="18" y="20" textAnchor="middle" className={`gauge-value-text ${tone}`}>
          {value == null ? "–" : `${pct.toFixed(0)}%`}
        </text>
      </svg>
      <p className="gauge-label">{label}</p>
    </div>
  );
}

// ── KPI Card with Sparkline ───────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  unit,
  history,
  tone = "neutral"
}: {
  label: string;
  value: string;
  unit?: string;
  history: number[];
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const toneColor: Record<string, string> = {
    success: "var(--color-success)",
    warning: "#d97706",
    danger: "var(--color-danger)",
    neutral: "var(--color-brand)"
  };
  const c = toneColor[tone];

  return (
    <div className={`kpi-card kpi-${tone}`}>
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <span className={`kpi-badge kpi-badge-${tone}`}>
          {tone === "success" ? "OK" : tone === "warning" ? "Warn" : tone === "danger" ? "Krit" : "Live"}
        </span>
      </div>
      <div className="kpi-value">
        {value}
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      <div className="kpi-chart">
        <Sparkline data={history} color={c} height={48} />
      </div>
    </div>
  );
}

// ── Status Dot ────────────────────────────────────────────────────────────────

function StatusRow({ overview }: { overview: MonitoringOverview | null }) {
  const services = [
    { name: "Backend", ok: overview !== null },
    { name: "Prometheus", ok: overview?.http.requestsPerSec !== undefined },
    { name: "Loki", ok: true },
    { name: "Grafana", ok: true }
  ];
  return (
    <div className="service-status-row">
      {services.map((s) => (
        <div key={s.name} className="service-status-item">
          <span className={`service-dot ${s.ok ? "up" : "down"}`} />
          <span className="service-status-name">{s.name}</span>
          <span className={`service-status-label ${s.ok ? "up" : "down"}`}>{s.ok ? "UP" : "DOWN"}</span>
        </div>
      ))}
    </div>
  );
}

// ── Log Stream ────────────────────────────────────────────────────────────────

function LogStream({ logs }: { logs: LogEntry[] }) {
  if (logs.length === 0)
    return <p className="hint" style={{ padding: "1rem 0" }}>Keine Logs im gewählten Zeitraum.</p>;

  return (
    <div className="log-stream">
      {logs.map((entry, i) => {
        const lvl = (entry.labels.level ?? "").toLowerCase();
        const tone = lvl === "error" ? "danger" : lvl === "warn" ? "warning" : "neutral";
        return (
          <div key={i} className={`log-entry log-entry-${tone}`}>
            <span className="log-ts">{new Date(entry.timestamp).toLocaleTimeString("de-DE")}</span>
            <span className={`log-level log-level-${tone}`}>{lvl || "log"}</span>
            <span className="log-service">{entry.labels.service ?? entry.labels.container ?? "–"}</span>
            <span className="log-line">{entry.line}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Export Bar ────────────────────────────────────────────────────────────────

function ExportBar({ token }: { token: string }) {
  const [range, setRange] = useState<ExportRange>("24h");
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async (format: ExportFormat) => {
    setBusy(format);
    setError(null);
    try {
      await monitoringApi.downloadExport(token, format, range);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="export-bar">
      <div className="export-bar-ranges">
        <span className="export-bar-label">Zeitraum:</span>
        {(["1h", "24h", "7d"] as ExportRange[]).map((r) => (
          <button
            key={r}
            type="button"
            className={`btn secondary mini ${range === r ? "active" : ""}`}
            onClick={() => setRange(r)}
          >
            {r === "1h" ? "1 Std." : r === "24h" ? "24 Std." : "7 Tage"}
          </button>
        ))}
      </div>
      <div className="export-bar-actions">
        <button type="button" className="btn mini" disabled={busy !== null} onClick={() => void download("json")}>
          {busy === "json" ? "…" : "↓ JSON"}
        </button>
        <button type="button" className="btn secondary mini" disabled={busy !== null} onClick={() => void download("csv")}>
          {busy === "csv" ? "…" : "↓ CSV"}
        </button>
      </div>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

// ── Grafana Panel Frame ───────────────────────────────────────────────────────

function GrafanaFrame({ src, title, height = 280 }: { src: string; title: string; height?: number }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="grafana-frame-wrapper">
      <div className="grafana-frame-label">{title}</div>
      {!loaded && !error && <div className="grafana-frame-skeleton" style={{ height }} />}
      {error && (
        <div className="grafana-frame-error" style={{ height }}>
          <p>Panel nicht erreichbar.</p>
          <a href={GRAFANA_URL} target="_blank" rel="noreferrer" className="btn secondary mini">Grafana öffnen ↗</a>
        </div>
      )}
      <iframe
        src={src}
        title={title}
        width="100%"
        height={height}
        frameBorder="0"
        style={{ display: loaded ? "block" : "none", borderRadius: 8, border: "1px solid var(--color-border)" }}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const HISTORY_LEN = 20;

function pushHistory(hist: number[], val: number | null): number[] {
  if (val == null) return hist;
  const next = [...hist, val];
  return next.length > HISTORY_LEN ? next.slice(-HISTORY_LEN) : next;
}

function toneOf(val: number | null, warn: number, crit: number): "neutral" | "success" | "warning" | "danger" {
  if (val == null) return "neutral";
  if (val >= crit) return "danger";
  if (val >= warn) return "warning";
  return "success";
}

function fmt(v: number | null, dec = 1): string {
  return v == null ? "–" : v.toFixed(dec);
}

export function MonitoringSection({ token }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<MonitoringOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logLevel, setLogLevel] = useState<"error" | "warn" | "info">("error");

  // Rolling history buffers für Sparklines
  const histRef = useRef({
    cpu: [] as number[],
    ram: [] as number[],
    disk: [] as number[],
    reqPerSec: [] as number[],
    errorRate: [] as number[],
    p95: [] as number[]
  });
  const [hist, setHist] = useState(histRef.current);

  const loadOverview = useCallback(async () => {
    try {
      const data = await monitoringApi.getOverview(token);
      setOverview(data);
      setError(null);
      histRef.current = {
        cpu: pushHistory(histRef.current.cpu, data.system.cpuPercent),
        ram: pushHistory(histRef.current.ram, data.system.ramPercent),
        disk: pushHistory(histRef.current.disk, data.system.diskPercent),
        reqPerSec: pushHistory(histRef.current.reqPerSec, data.http.requestsPerSec),
        errorRate: pushHistory(histRef.current.errorRate, data.http.errorRatePercent),
        p95: pushHistory(histRef.current.p95, data.http.p95LatencySeconds != null ? data.http.p95LatencySeconds * 1000 : null)
      };
      setHist({ ...histRef.current });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Metriken nicht erreichbar");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await monitoringApi.getLogs(token, { level: logLevel, limit: 100 });
      setLogs(data.logs);
    } finally {
      setLogsLoading(false);
    }
  }, [token, logLevel]);

  useEffect(() => { void loadOverview(); }, [loadOverview]);

  // Auto-refresh alle 30s
  useEffect(() => {
    if (tab !== "overview") return;
    const id = setInterval(() => { void loadOverview(); }, 30_000);
    return () => clearInterval(id);
  }, [tab, loadOverview]);

  useEffect(() => {
    if (tab === "logs") void loadLogs();
  }, [tab, loadLogs]);

  const sys = overview?.system;
  const http = overview?.http;
  const biz = overview?.business;

  return (
    <div className="monitoring-section">

      {/* ── Tab-Navigation ───────────────────────────────────────────────── */}
      <div className="monitoring-tabs-bar">
        <nav className="monitoring-tabs">
          {(["overview", "system", "application", "logs"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`monitoring-tab${tab === t ? " active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "overview" ? "Übersicht" : t === "system" ? "System" : t === "application" ? "Application" : "Logs"}
            </button>
          ))}
        </nav>
        <a href={grafanaDashboardUrl("toolshare-system")} target="_blank" rel="noreferrer" className="btn secondary mini">
          Grafana ↗
        </a>
      </div>

      {/* ── Übersicht ────────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="stack">

          {/* Service-Status Banner */}
          <div className="monitoring-status-banner">
            <StatusRow overview={overview} />
            {overview && (
              <span className="monitoring-updated">
                Aktualisiert: {new Date(overview.collectedAt).toLocaleTimeString("de-DE")}
                <button type="button" className="monitoring-refresh-btn" onClick={() => void loadOverview()} title="Jetzt aktualisieren">
                  ↺
                </button>
              </span>
            )}
          </div>

          {error && (
            <div className="monitoring-error-banner">
              <strong>Monitoring nicht erreichbar</strong> – Läuft der Monitoring-Stack?
              <button type="button" className="btn secondary mini" style={{ marginLeft: 12 }} onClick={() => void loadOverview()}>
                Erneut versuchen
              </button>
            </div>
          )}

          {loading && !overview && (
            <div className="monitoring-skeleton-grid">
              {[...Array(3)].map((_, i) => <div key={i} className="monitoring-skeleton" />)}
            </div>
          )}

          {overview && (
            <>
              {/* System Gauges */}
              <Surface title="System" subtitle="CPU, RAM und Festplatte auf dem Host-Server.">
                <div className="gauge-row">
                  <CircularGauge value={sys?.cpuPercent ?? null} label="CPU" />
                  <CircularGauge value={sys?.ramPercent ?? null} label="RAM" />
                  <CircularGauge value={sys?.diskPercent ?? null} label="Disk /" />
                </div>
              </Surface>

              {/* HTTP KPI-Karten mit Sparklines */}
              <Surface title="HTTP Traffic" subtitle="Live-Metriken des Express-Backends – aktualisiert alle 30 Sekunden.">
                <div className="kpi-grid">
                  <KpiCard
                    label="Requests / s"
                    value={fmt(http?.requestsPerSec ?? null, 2)}
                    history={hist.reqPerSec}
                    tone="neutral"
                  />
                  <KpiCard
                    label="Fehlerrate"
                    value={fmt(http?.errorRatePercent ?? null, 2)}
                    unit="%"
                    history={hist.errorRate}
                    tone={toneOf(http?.errorRatePercent ?? null, 1, 5)}
                  />
                  <KpiCard
                    label="P95 Latenz"
                    value={http?.p95LatencySeconds != null ? `${(http.p95LatencySeconds * 1000).toFixed(0)}` : "–"}
                    unit=" ms"
                    history={hist.p95}
                    tone={toneOf(
                      http?.p95LatencySeconds != null ? http.p95LatencySeconds * 1000 : null,
                      500, 2000
                    )}
                  />
                </div>
              </Surface>

              {/* Business-Metriken */}
              <Surface title="Business" subtitle="Aktivität und Wachstum der Toolshare-Plattform.">
                <div className="biz-grid">
                  <div className="biz-card">
                    <span className="biz-icon"></span>
                    <span className="biz-value">{fmt(biz?.activeUsers ?? null, 0)}</span>
                    <span className="biz-label">Aktive User</span>
                    <span className="biz-sub">5-Min-Fenster</span>
                  </div>
                  <div className="biz-card">
                    <span className="biz-icon"></span>
                    <span className="biz-value">{fmt(biz?.registrationsTotal ?? null, 0)}</span>
                    <span className="biz-label">Registrierungen</span>
                    <span className="biz-sub">Gesamt</span>
                  </div>
                  <div className="biz-card">
                    <span className="biz-icon"></span>
                    <span className="biz-value">{fmt(biz?.bookingsTotal ?? null, 0)}</span>
                    <span className="biz-label">Buchungen</span>
                    <span className="biz-sub">Gesamt</span>
                  </div>
                  <div className="biz-card">
                    <span className="biz-icon"></span>
                    <span className="biz-value">{fmt(biz?.loginsSuccess ?? null, 0)}</span>
                    <span className="biz-label">Logins</span>
                    <span className={`biz-sub ${(biz?.loginsFailed ?? 0) > 10 ? "biz-sub-warn" : ""}`}>
                      {fmt(biz?.loginsFailed ?? null, 0)} fehlgeschlagen
                    </span>
                  </div>
                </div>
              </Surface>

              {/* Export */}
              <Surface title="Daten exportieren" subtitle="Zeitreihendaten als JSON oder CSV für Berichte herunterladen.">
                <ExportBar token={token} />
              </Surface>
            </>
          )}
        </div>
      )}

      {/* ── System Dashboard (iframes) ───────────────────────────────────── */}
      {tab === "system" && (
        <Surface title="System Dashboard" subtitle="CPU, RAM, Festplatte und Netzwerk via Node Exporter.">
          <div className="grafana-panels-grid">
            <GrafanaFrame src={grafanaPanelUrl("toolshare-system", 1, "refresh=30s")} title="CPU-Auslastung" />
            <GrafanaFrame src={grafanaPanelUrl("toolshare-system", 2, "refresh=30s")} title="RAM-Auslastung" />
            <GrafanaFrame src={grafanaPanelUrl("toolshare-system", 7, "refresh=30s")} title="Festplattennutzung" />
            <GrafanaFrame src={grafanaPanelUrl("toolshare-system", 8, "refresh=30s")} title="Netzwerk I/O" />
          </div>
          <p className="hint">
            <a href={grafanaDashboardUrl("toolshare-system")} target="_blank" rel="noreferrer">Vollständiges Dashboard in Grafana ↗</a>
          </p>
        </Surface>
      )}

      {/* ── Application Dashboard (iframes) ─────────────────────────────── */}
      {tab === "application" && (
        <Surface title="Application Dashboard" subtitle="HTTP-Traffic, Fehler, Antwortzeiten und Business-KPIs.">
          <div className="grafana-panels-grid">
            <GrafanaFrame src={grafanaPanelUrl("toolshare-application", 5, "refresh=15s")} title="Requests / s" />
            <GrafanaFrame src={grafanaPanelUrl("toolshare-application", 6, "refresh=15s")} title="Status-Codes" />
            <GrafanaFrame src={grafanaPanelUrl("toolshare-application", 7, "refresh=15s")} title="Antwortzeiten" />
            <GrafanaFrame src={grafanaPanelUrl("toolshare-application", 8, "refresh=15s")} title="Fehler-Tabelle" />
          </div>
          <p className="hint">
            <a href={grafanaDashboardUrl("toolshare-application")} target="_blank" rel="noreferrer">Vollständiges Dashboard in Grafana ↗</a>
          </p>
        </Surface>
      )}

      {/* ── Logs ─────────────────────────────────────────────────────────── */}
      {tab === "logs" && (
        <Surface title="Log-Analyse" subtitle="Echtzeit-Logs aus dem Docker-Cluster via Loki.">
          <div className="row">
            {(["error", "warn", "info"] as const).map((l) => (
              <button
                key={l}
                type="button"
                className={`btn secondary mini${logLevel === l ? " active" : ""}`}
                onClick={() => setLogLevel(l)}
              >
                {l === "error" ? "🔴 Fehler" : l === "warn" ? "🟡 Warnungen" : "🔵 Info"}
              </button>
            ))}
            <button
              type="button"
              className="btn mini"
              disabled={logsLoading}
              style={{ marginLeft: "auto" }}
              onClick={() => void loadLogs()}
            >
              {logsLoading ? "Lade…" : "↺ Aktualisieren"}
            </button>
          </div>
          <LogStream logs={logs} />
          <p className="hint">
            <a href={grafanaDashboardUrl("toolshare-logs")} target="_blank" rel="noreferrer">Log-Dashboard in Grafana ↗</a>
          </p>
        </Surface>
      )}
    </div>
  );
}
