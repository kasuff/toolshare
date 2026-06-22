interface FrontendImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_GRAFANA_URL?: string;
}

const API_BASE =
  ((import.meta as unknown as { env: FrontendImportMetaEnv }).env.VITE_API_URL as string | undefined) ??
  "http://localhost:4000/api";

export const GRAFANA_URL =
  ((import.meta as unknown as { env: FrontendImportMetaEnv }).env.VITE_GRAFANA_URL as string | undefined) ??
  "http://localhost:3001";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MonitoringOverview = {
  collectedAt: string;
  system: {
    cpuPercent: number | null;
    ramPercent: number | null;
    diskPercent: number | null;
  };
  http: {
    requestsPerSec: number | null;
    errorRatePercent: number | null;
    p95LatencySeconds: number | null;
  };
  business: {
    activeUsers: number | null;
    registrationsTotal: number | null;
    bookingsTotal: number | null;
    loginsSuccess: number | null;
    loginsFailed: number | null;
  };
};

export type LogEntry = {
  timestamp: string;
  line: string;
  labels: Record<string, string>;
};

export type LogsResponse = {
  logs: LogEntry[];
  count: number;
  query: string;
};

export type ExportRange = "1h" | "24h" | "7d";
export type ExportFormat = "json" | "csv" | "pdf";

export type DoraMetrics = {
  collectedAt: string;
  windowDays: number | null;
  lastCollectedAt: string | null;
  deploymentFrequencyPerDay: number | null;
  leadTimeSeconds: number | null;
  changeFailureRate: number | null; // 0..1
  timeToRestoreSeconds: number | null;
  deploymentsInWindow: number | null;
  failuresInWindow: number | null;
};

// ── Grafana Panel URLs ────────────────────────────────────────────────────────

export type GrafanaPanel = {
  title: string;
  url: string;
};

export function grafanaPanelUrl(dashboardUid: string, panelId: number, extraParams?: string): string {
  const base = `${GRAFANA_URL}/d-solo/${dashboardUid}`;
  return `${base}?orgId=1&panelId=${panelId}&theme=light&kiosk${extraParams ? `&${extraParams}` : ""}`;
}

export function grafanaDashboardUrl(dashboardUid: string): string {
  return `${GRAFANA_URL}/d/${dashboardUid}?orgId=1&kiosk`;
}

// ── API Client ────────────────────────────────────────────────────────────────

async function monitoringFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_BASE}/monitoring${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Monitoring API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const monitoringApi = {
  getOverview(token: string): Promise<MonitoringOverview> {
    return monitoringFetch<MonitoringOverview>("/overview", token);
  },

  getLogs(token: string, options?: { limit?: number; level?: "error" | "warn" | "info"; service?: string }): Promise<LogsResponse> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.level) params.set("level", options.level);
    if (options?.service) params.set("service", options.service);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return monitoringFetch<LogsResponse>(`/logs${qs}`, token);
  },

  getDora(token: string): Promise<DoraMetrics> {
    return monitoringFetch<DoraMetrics>("/dora", token);
  },

  // Lädt Exportdaten als Blob und löst Browser-Download aus
  async downloadExport(token: string, format: ExportFormat, range: ExportRange): Promise<void> {
    const res = await fetch(
      `${API_BASE}/monitoring/export?format=${format}&range=${range}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(`Export fehlgeschlagen: ${res.statusText}`);

    await triggerDownload(res, `export-${range}.${format}`);
  },

  // Lädt den DORA-PDF-Report (Backend proxyt den dora-exporter)
  async downloadDoraReport(token: string, days: number): Promise<void> {
    const res = await fetch(`${API_BASE}/monitoring/dora/report.pdf?days=${days}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`PDF-Export fehlgeschlagen: ${res.statusText}`);

    await triggerDownload(res, `toolshare-dora-${days}d.pdf`);
  },

  // Lädt den Gesamtbericht (System + HTTP + Business + DORA) als PDF
  async downloadFullReport(token: string, days: number): Promise<void> {
    const res = await fetch(`${API_BASE}/monitoring/report.pdf?days=${days}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Gesamtbericht fehlgeschlagen: ${res.statusText}`);

    await triggerDownload(res, `toolshare-gesamtbericht-${days}d.pdf`);
  }
};

// Löst aus einer fetch-Response einen Browser-Download aus.
async function triggerDownload(res: Response, fallbackName: string): Promise<void> {
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const filenameMatch = disposition.match(/filename="([^"]+)"/);
  const filename = filenameMatch?.[1] ?? fallbackName;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
