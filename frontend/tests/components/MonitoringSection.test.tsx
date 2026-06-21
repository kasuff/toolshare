import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MonitoringSection } from "../../src/components/MonitoringSection";

const { getOverview, getLogs, downloadExport } = vi.hoisted(() => ({
  getOverview: vi.fn(),
  getLogs: vi.fn(),
  downloadExport: vi.fn()
}));

vi.mock("../../src/services/monitoringApi", async () => {
  const actual = await vi.importActual<typeof import("../../src/services/monitoringApi")>(
    "../../src/services/monitoringApi"
  );
  return {
    ...actual,
    monitoringApi: {
      getOverview,
      getLogs,
      downloadExport
    }
  };
});

const overview = {
  collectedAt: "2026-06-01T12:00:00.000Z",
  system: { cpuPercent: 12, ramPercent: 45, diskPercent: 60 },
  http: { requestsPerSec: 3.2, errorRatePercent: 1.1, p95LatencySeconds: 0.2 },
  business: {
    activeUsers: 4,
    registrationsTotal: 20,
    bookingsTotal: 8,
    loginsSuccess: 15,
    loginsFailed: 2
  }
};

describe("MonitoringSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOverview.mockResolvedValue(overview);
    getLogs.mockResolvedValue({ logs: [], count: 0, query: "level=error" });
    downloadExport.mockResolvedValue(undefined);
  });

  it("loads overview metrics and switches to logs tab", async () => {
    render(<MonitoringSection token="token-1" />);

    expect(await screen.findByRole("button", { name: "Übersicht" })).toBeInTheDocument();
    expect(screen.getByText("12%")).toBeInTheDocument();
    expect(getOverview).toHaveBeenCalledWith("token-1");

    fireEvent.click(screen.getByRole("button", { name: "Logs" }));
    await waitFor(() => expect(getLogs).toHaveBeenCalledWith("token-1", expect.objectContaining({ level: "error" })));
  });

  it("triggers export download", async () => {
    render(<MonitoringSection token="token-1" />);
    await screen.findByText("12%");

    fireEvent.click(screen.getByRole("button", { name: "↓ JSON" }));
    await waitFor(() => expect(downloadExport).toHaveBeenCalledWith("token-1", "json", "24h"));
  });
});
