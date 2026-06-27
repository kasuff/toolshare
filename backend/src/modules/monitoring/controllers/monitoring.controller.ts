import { Request, Response } from "express";
import { env } from "../../../config/env";
import { asyncHandler } from "../../../utils/async-handler";

// ── Prometheus-Abfragen ───────────────────────────────────────────────────────

const QUERIES = {
  cpuPercent: '100 - (avg(irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
  ramPercent: "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100",
  diskPercent:
    '(1 - (node_filesystem_avail_bytes{mountpoint="/",fstype!="rootfs"} / node_filesystem_size_bytes{mountpoint="/",fstype!="rootfs"})) * 100',
  httpReqPerSec: "sum(rate(http_requests_total[5m]))",
  errorRatePercent:
    "sum(rate(http_requests_total{status_code=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m])) * 100",
  p95LatencySec:
    "histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))",
  activeUsers: "toolshare_active_users",
  registrationsTotal: "toolshare_user_registrations_total",
  bookingsTotal: "toolshare_bookings_created_total",
  loginsSuccess: "toolshare_user_logins_total{status=\"success\"}",
  loginsFailed: "toolshare_user_logins_total{status=\"failed\"}",
  // ── DORA (vom dora-exporter gescraped) ───────────────────────────────────
  doraDeployFreq: "dora_deployment_frequency_per_day",
  doraLeadTime: "dora_lead_time_seconds",
  doraChangeFailureRate: "dora_change_failure_rate",
  doraTimeToRestore: "dora_time_to_restore_seconds",
  doraDeploymentsWindow: "dora_deployments_window",
  doraFailuresWindow: "dora_failures_window",
  doraWindowDays: "dora_window_days",
  doraLastCollect: "dora_last_collect_timestamp_seconds"
} as const;

async function queryPrometheus(query: string): Promise<number | null> {
  const url = new URL("/api/v1/query", env.prometheusUrl);
  url.searchParams.set("query", query);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    status: string;
    data: { resultType: string; result: { value: [number, string] }[] };
  };
  const value = json.data?.result?.[0]?.value?.[1];
  return value != null ? parseFloat(value) : null;
}

async function queryPrometheusRange(
  query: string,
  startSec: number,
  endSec: number,
  step = "60"
): Promise<{ timestamp: string; value: number }[]> {
  const url = new URL("/api/v1/query_range", env.prometheusUrl);
  url.searchParams.set("query", query);
  url.searchParams.set("start", String(startSec));
  url.searchParams.set("end", String(endSec));
  url.searchParams.set("step", step);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];

  const json = (await res.json()) as {
    data: { result: { values: [number, string][] }[] };
  };
  return (json.data?.result?.[0]?.values ?? []).map(([ts, val]) => ({
    timestamp: new Date(ts * 1000).toISOString(),
    value: parseFloat(val)
  }));
}

async function queryLoki(
  logQuery: string,
  limit = 50
): Promise<{ timestamp: string; line: string; labels: Record<string, string> }[]> {
  const nowNs = BigInt(Date.now()) * 1_000_000n;
  const hourAgoNs = nowNs - 3_600_000_000_000n;

  const url = new URL("/loki/api/v1/query_range", env.lokiUrl);
  url.searchParams.set("query", logQuery);
  url.searchParams.set("start", hourAgoNs.toString());
  url.searchParams.set("end", nowNs.toString());
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("direction", "backward");

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];

  const json = (await res.json()) as {
    data: { result: { stream: Record<string, string>; values: [string, string][] }[] };
  };

  return (json.data?.result ?? []).flatMap((stream) =>
    stream.values.map(([tsNs, line]) => ({
      timestamp: new Date(Number(BigInt(tsNs) / 1_000_000n)).toISOString(),
      line,
      labels: stream.stream
    }))
  );
}

// ── Controller ────────────────────────────────────────────────────────────────

export const monitoringController = {
  // GET /api/monitoring/overview
  // Liefert einen Snapshot aller wichtigen Metriken als JSON
  overview: asyncHandler(async (_req: Request, res: Response) => {
    const [
      cpu,
      ram,
      disk,
      httpReqPerSec,
      errorRate,
      p95Latency,
      activeUsers,
      registrations,
      bookings,
      loginsSuccess,
      loginsFailed
    ] = await Promise.allSettled([
      queryPrometheus(QUERIES.cpuPercent),
      queryPrometheus(QUERIES.ramPercent),
      queryPrometheus(QUERIES.diskPercent),
      queryPrometheus(QUERIES.httpReqPerSec),
      queryPrometheus(QUERIES.errorRatePercent),
      queryPrometheus(QUERIES.p95LatencySec),
      queryPrometheus(QUERIES.activeUsers),
      queryPrometheus(QUERIES.registrationsTotal),
      queryPrometheus(QUERIES.bookingsTotal),
      queryPrometheus(QUERIES.loginsSuccess),
      queryPrometheus(QUERIES.loginsFailed)
    ]);

    const val = (r: PromiseSettledResult<number | null>) =>
      r.status === "fulfilled" ? r.value : null;

    res.json({
      collectedAt: new Date().toISOString(),
      system: {
        cpuPercent: val(cpu),
        ramPercent: val(ram),
        diskPercent: val(disk)
      },
      http: {
        requestsPerSec: val(httpReqPerSec),
        errorRatePercent: val(errorRate),
        p95LatencySeconds: val(p95Latency)
      },
      business: {
        activeUsers: val(activeUsers),
        registrationsTotal: val(registrations),
        bookingsTotal: val(bookings),
        loginsSuccess: val(loginsSuccess),
        loginsFailed: val(loginsFailed)
      }
    });
  }),

  // GET /api/monitoring/logs?limit=50
  // Liefert die letzten Fehler-Logs aus Loki
  logs: asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 500);
    const level = String(req.query.level ?? "error");
    const service = req.query.service ? String(req.query.service) : null;

    let lokiQuery = `{job="docker"}`;
    if (service) lokiQuery = `{job="docker", service="${service}"}`;
    if (level === "error") lokiQuery += ` |= "error"`;
    else if (level === "warn") lokiQuery += ` |~ "(?i)warn"`;

    const logs = await queryLoki(lokiQuery, limit);
    res.json({ logs, count: logs.length, query: lokiQuery });
  }),

  // GET /api/monitoring/export?format=json|csv&range=1h|24h|7d
  // Exportiert Zeitreihen-Metriken für Reporting
  export: asyncHandler(async (req: Request, res: Response) => {
    const format = String(req.query.format ?? "json");
    const range = String(req.query.range ?? "1h");

    // PDF: charted Report über den Reporting-Service (dora-exporter) erzeugen.
    if (format === "pdf") {
      const url = new URL("/metrics-report.pdf", env.doraExporterUrl);
      url.searchParams.set("range", range);
      const upstream = await fetch(url.toString(), { signal: AbortSignal.timeout(60000) });
      if (!upstream.ok) {
        return res.status(502).json({ error: "Report-Service nicht erreichbar." });
      }
      const filename = `toolshare-metrics-${range}-${new Date().toISOString().slice(0, 10)}.pdf`;
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(buffer);
    }

    const rangeSec = range === "7d" ? 7 * 86400 : range === "24h" ? 86400 : 3600;
    const endSec = Math.floor(Date.now() / 1000);
    const startSec = endSec - rangeSec;
    const step = rangeSec <= 3600 ? "60" : rangeSec <= 86400 ? "300" : "1800";

    const [httpReqs, errors, latency] = await Promise.all([
      queryPrometheusRange(QUERIES.httpReqPerSec, startSec, endSec, step),
      queryPrometheusRange(QUERIES.errorRatePercent, startSec, endSec, step),
      queryPrometheusRange(QUERIES.p95LatencySec, startSec, endSec, step)
    ]);

    const rows = httpReqs.map((row, i) => ({
      timestamp: row.timestamp,
      requestsPerSec: row.value,
      errorRatePercent: errors[i]?.value ?? null,
      p95LatencySeconds: latency[i]?.value ?? null
    }));

    if (format === "csv") {
      const filename = `toolshare-metrics-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
      const headers = ["timestamp", "requestsPerSec", "errorRatePercent", "p95LatencySeconds"];
      const csv = [
        headers.join(","),
        ...rows.map((r) =>
          [r.timestamp, r.requestsPerSec?.toFixed(4) ?? "", r.errorRatePercent?.toFixed(4) ?? "", r.p95LatencySeconds?.toFixed(4) ?? ""].join(",")
        )
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(csv);
    }

    // JSON (default)
    const filename = `toolshare-metrics-${range}-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.json({
      exportedAt: new Date().toISOString(),
      range,
      rowCount: rows.length,
      columns: ["timestamp", "requestsPerSec", "errorRatePercent", "p95LatencySeconds"],
      rows
    });
  }),

  // GET /api/monitoring/dora
  // Snapshot der vier DORA-Metriken (vom dora-exporter, via Prometheus).
  // NaN-Gauges (noch keine Daten) werden von JSON.stringify zu null.
  dora: asyncHandler(async (_req: Request, res: Response) => {
    const [freq, lead, cfr, ttr, deployments, failures, windowDays, lastCollect] =
      await Promise.allSettled([
        queryPrometheus(QUERIES.doraDeployFreq),
        queryPrometheus(QUERIES.doraLeadTime),
        queryPrometheus(QUERIES.doraChangeFailureRate),
        queryPrometheus(QUERIES.doraTimeToRestore),
        queryPrometheus(QUERIES.doraDeploymentsWindow),
        queryPrometheus(QUERIES.doraFailuresWindow),
        queryPrometheus(QUERIES.doraWindowDays),
        queryPrometheus(QUERIES.doraLastCollect)
      ]);

    const val = (r: PromiseSettledResult<number | null>) => {
      const v = r.status === "fulfilled" ? r.value : null;
      return v != null && Number.isFinite(v) ? v : null;
    };

    res.json({
      collectedAt: new Date().toISOString(),
      windowDays: val(windowDays),
      lastCollectedAt: val(lastCollect) != null ? new Date(val(lastCollect)! * 1000).toISOString() : null,
      deploymentFrequencyPerDay: val(freq),
      leadTimeSeconds: val(lead),
      changeFailureRate: val(cfr),
      timeToRestoreSeconds: val(ttr),
      deploymentsInWindow: val(deployments),
      failuresInWindow: val(failures)
    });
  }),

  // GET /api/monitoring/dora/report.pdf?days=90
  // Proxyt den PDF-Report des dora-exporters (Port bleibt intern, MANAGER-Auth
  // greift über den Router). Antwort wird als Datei-Download durchgereicht.
  doraReport: asyncHandler(async (req: Request, res: Response) => {
    const daysRaw = parseInt(String(req.query.days ?? "90"), 10);
    const days = Number.isFinite(daysRaw) ? Math.min(Math.max(daysRaw, 1), 730) : 90;
    return proxyExporterPdf(res, "/report.pdf", { days: String(days) }, `toolshare-dora-${days}d.pdf`);
  }),

  // GET /api/monitoring/report.pdf?days=30
  // Gesamtbericht über ALLE Monitoring-Daten (System, HTTP, Business, DORA).
  fullReport: asyncHandler(async (req: Request, res: Response) => {
    const daysRaw = parseInt(String(req.query.days ?? "30"), 10);
    const days = Number.isFinite(daysRaw) ? Math.min(Math.max(daysRaw, 1), 730) : 30;
    return proxyExporterPdf(res, "/full-report.pdf", { days: String(days) }, `toolshare-gesamtbericht-${days}d.pdf`);
  })
};

// Holt ein PDF vom Reporting-Service (dora-exporter) und reicht es als Download
// durch. Der Exporter-Port bleibt intern; die MANAGER-Auth greift über den Router.
async function proxyExporterPdf(
  res: Response,
  path: string,
  params: Record<string, string>,
  fallbackName: string
): Promise<Response> {
  const url = new URL(path, env.doraExporterUrl);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const upstream = await fetch(url.toString(), { signal: AbortSignal.timeout(120000) });
  if (!upstream.ok) {
    return res.status(502).json({ error: "Report-Service nicht erreichbar oder Report fehlgeschlagen." });
  }

  const filename = `${fallbackName.replace(/\.pdf$/, "")}-${new Date().toISOString().slice(0, 10)}.pdf`;
  const buffer = Buffer.from(await upstream.arrayBuffer());
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(buffer);
}