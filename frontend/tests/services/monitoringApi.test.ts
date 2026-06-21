import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GRAFANA_URL,
  grafanaDashboardUrl,
  grafanaPanelUrl,
  monitoringApi
} from "../../src/services/monitoringApi";

const fetchMock = vi.fn();

describe("monitoringApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:export"),
      revokeObjectURL: vi.fn()
    });
  });

  it("builds grafana panel and dashboard urls", () => {
    expect(grafanaPanelUrl("app-dashboard", 4, "refresh=30s")).toContain(`${GRAFANA_URL}/d-solo/app-dashboard`);
    expect(grafanaPanelUrl("app-dashboard", 4, "refresh=30s")).toContain("panelId=4");
    expect(grafanaDashboardUrl("app-dashboard")).toBe(`${GRAFANA_URL}/d/app-dashboard?orgId=1&kiosk`);
  });

  it("loads overview and logs with query params", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ collectedAt: "now", system: {}, http: {}, business: {} })
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ logs: [{ timestamp: "t", line: "error", labels: {} }], count: 1, query: "level=error" })
    });

    const overview = await monitoringApi.getOverview("token-1");
    const logs = await monitoringApi.getLogs("token-1", { limit: 25, level: "error", service: "backend" });

    expect(overview).toMatchObject({ collectedAt: "now" });
    expect(logs.count).toBe(1);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/monitoring/overview"),
      expect.objectContaining({ headers: { Authorization: "Bearer token-1" } })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/\/monitoring\/logs\?.*limit=25.*level=error.*service=backend/),
      expect.any(Object)
    );
  });

  it("throws on failed overview requests", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => "unavailable"
    });

    await expect(monitoringApi.getOverview("token-1")).rejects.toThrow(/Monitoring API error 503/);
  });

  it("downloads export blobs via temporary link", async () => {
    const click = vi.fn();
    const appendChild = vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
    const removeChild = vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);
    vi.spyOn(document, "createElement").mockReturnValue({
      click,
      href: "",
      download: ""
    } as HTMLAnchorElement);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      statusText: "OK",
      headers: {
        get: () => 'attachment; filename="metrics-24h.json"'
      },
      blob: async () => new Blob(['{"ok":true}'], { type: "application/json" })
    });

    await monitoringApi.downloadExport("token-1", "json", "24h");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/monitoring/export?format=json&range=24h"),
      expect.objectContaining({ headers: { Authorization: "Bearer token-1" } })
    );
    expect(click).toHaveBeenCalledTimes(1);

    appendChild.mockRestore();
    removeChild.mockRestore();
  });
});
