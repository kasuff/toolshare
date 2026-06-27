import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";
import type { Express } from "express";
import { authRepository } from "../src/modules/auth/repositories/auth.repository";

vi.mock("../src/modules/auth/repositories/auth.repository", () => ({
  authRepository: {
    findById: vi.fn()
  }
}));

const mockedAuthRepository = vi.mocked(authRepository);

const MANAGER_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";

const prometheusInstant = (value: string) => ({
  ok: true,
  json: async () => ({
    status: "success",
    data: {
      resultType: "vector",
      result: [{ value: [Math.floor(Date.now() / 1000), value] }]
    }
  })
});

const prometheusRange = (values: [number, string][]) => ({
  ok: true,
  json: async () => ({
    data: {
      result: [{ values }]
    }
  })
});

const lokiResponse = (
  entries: { line: string; labels?: Record<string, string> }[],
  baseTsNs = "1700000000000000000"
) => ({
  ok: true,
  json: async () => ({
    data: {
      result: entries.map((entry, index) => ({
        stream: entry.labels ?? { job: "docker", service: "backend" },
        values: [[`${BigInt(baseTsNs) + BigInt(index)}`, entry.line]]
      }))
    }
  })
});

describe("monitoring controller", () => {
  let app: Express;
  let fetchMock: ReturnType<typeof vi.fn>;

  const managerToken = () =>
    jwt.sign({ userId: MANAGER_ID, role: "MANAGER" }, process.env.JWT_SECRET as string);

  const userToken = () => jwt.sign({ userId: USER_ID, role: "USER" }, process.env.JWT_SECRET as string);

  beforeAll(async () => {
    process.env.DATABASE_URL ??= "postgresql://toolshare:toolshare@localhost:5432/toolshare_test";
    process.env.JWT_SECRET ??= "test-secret";
    process.env.PROMETHEUS_URL ??= "http://prometheus.test";
    process.env.LOKI_URL ??= "http://loki.test";

    const appModule = await import("../src/app");
    app = appModule.createApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    mockedAuthRepository.findById.mockImplementation(async (id) => {
      if (id === MANAGER_ID) {
        return { id: MANAGER_ID, role: "MANAGER", isSuspended: false } as never;
      }
      if (id === USER_ID) {
        return { id: USER_ID, role: "USER", isSuspended: false } as never;
      }
      return null;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("GET /api/monitoring/overview", () => {
    it("returns aggregated metrics from Prometheus", async () => {
      fetchMock.mockImplementation(async (url: string) => {
        const query = new URL(url).searchParams.get("query") ?? "";

        if (query.includes("node_cpu_seconds_total")) return prometheusInstant("12.5");
        if (query.includes("node_memory_MemAvailable_bytes")) return prometheusInstant("34.2");
        if (query.includes("node_filesystem_avail_bytes")) return prometheusInstant("56.7");
        if (query.includes("http_requests_total{status_code")) return prometheusInstant("1.2");
        if (query.includes("sum(rate(http_requests_total[5m]))")) return prometheusInstant("8.4");
        if (query.includes("histogram_quantile")) return prometheusInstant("0.123");
        if (query.includes("toolshare_active_users")) return prometheusInstant("5");
        if (query.includes("toolshare_user_registrations_total")) return prometheusInstant("100");
        if (query.includes("toolshare_bookings_created_total")) return prometheusInstant("42");
        if (query.includes('status="success"')) return prometheusInstant("90");
        if (query.includes('status="failed"')) return prometheusInstant("3");

        return { ok: false, json: async () => ({}) };
      });

      const response = await request(app)
        .get("/api/monitoring/overview")
        .set("Authorization", `Bearer ${managerToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.collectedAt).toBeTypeOf("string");
      expect(response.body.system).toEqual({
        cpuPercent: 12.5,
        ramPercent: 34.2,
        diskPercent: 56.7
      });
      expect(response.body.http).toEqual({
        requestsPerSec: 8.4,
        errorRatePercent: 1.2,
        p95LatencySeconds: 0.123
      });
      expect(response.body.business).toEqual({
        activeUsers: 5,
        registrationsTotal: 100,
        bookingsTotal: 42,
        loginsSuccess: 90,
        loginsFailed: 3
      });
      expect(fetchMock.mock.calls.every(([url]) => String(url).includes("/api/v1/query"))).toBe(true);
    });

    it("returns null values when Prometheus is unavailable", async () => {
      fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });

      const response = await request(app)
        .get("/api/monitoring/overview")
        .set("Authorization", `Bearer ${managerToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.system.cpuPercent).toBeNull();
      expect(response.body.http.requestsPerSec).toBeNull();
      expect(response.body.business.activeUsers).toBeNull();
    });
  });

  describe("GET /api/monitoring/logs", () => {
    it("returns error logs from Loki with default query", async () => {
      fetchMock.mockResolvedValueOnce(
        lokiResponse([{ line: "error: database timeout", labels: { job: "docker", service: "backend" } }])
      );

      const response = await request(app)
        .get("/api/monitoring/logs")
        .set("Authorization", `Bearer ${managerToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(1);
      expect(response.body.query).toBe('{job="docker"} |= "error"');
      expect(response.body.logs[0]).toMatchObject({
        line: "error: database timeout",
        labels: { job: "docker", service: "backend" }
      });
      expect(response.body.logs[0].timestamp).toBeTypeOf("string");

      const lokiUrl = new URL(String(fetchMock.mock.calls[0][0]));
      expect(lokiUrl.pathname).toBe("/loki/api/v1/query_range");
      expect(lokiUrl.searchParams.get("limit")).toBe("50");
    });

    it("supports service filter, warn level and capped limit", async () => {
      fetchMock.mockResolvedValueOnce(lokiResponse([]));

      const response = await request(app)
        .get("/api/monitoring/logs")
        .query({ service: "frontend", level: "warn", limit: "9999" })
        .set("Authorization", `Bearer ${managerToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.query).toBe('{job="docker", service="frontend"} |~ "(?i)warn"');

      const lokiUrl = new URL(String(fetchMock.mock.calls[0][0]));
      expect(lokiUrl.searchParams.get("limit")).toBe("500");
    });

    it("returns an empty list when Loki fails", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

      const response = await request(app)
        .get("/api/monitoring/logs")
        .set("Authorization", `Bearer ${managerToken()}`);

      expect(response.status).toBe(200);
      expect(response.body.logs).toEqual([]);
      expect(response.body.count).toBe(0);
    });
  });

  describe("GET /api/monitoring/export", () => {
    const nowSec = Math.floor(Date.now() / 1000);

    beforeEach(() => {
      fetchMock.mockImplementation(async (url: string) => {
        const parsed = new URL(url);
        const query = parsed.searchParams.get("query") ?? "";
        const step = parsed.searchParams.get("step") ?? "60";

        const values: [number, string][] =
          step === "1800"
            ? [
                [nowSec - 7200, "1.0"],
                [nowSec - 3600, "2.0"]
              ]
            : step === "300"
              ? [
                  [nowSec - 600, "3.0"],
                  [nowSec - 300, "4.0"]
                ]
              : [
                  [nowSec - 120, "5.0"],
                  [nowSec - 60, "6.0"]
                ];

        if (query.includes("http_requests_total{status_code")) {
          return prometheusRange(values.map(([ts, val]) => [ts, String(Number(val) / 10)]));
        }
        if (query.includes("histogram_quantile")) {
          return prometheusRange(values.map(([ts, val]) => [ts, String(Number(val) / 100)]));
        }
        if (query.includes("sum(rate(http_requests_total[5m]))")) {
          return prometheusRange(values);
        }

        return { ok: false, json: async () => ({}) };
      });
    });

    it("exports JSON time series for the default 1h range", async () => {
      const response = await request(app)
        .get("/api/monitoring/export")
        .set("Authorization", `Bearer ${managerToken()}`);

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
      expect(response.headers["content-disposition"]).toMatch(/toolshare-metrics-1h-.*\.json/);
      expect(response.body.range).toBe("1h");
      expect(response.body.rowCount).toBe(2);
      expect(response.body.rows[0]).toMatchObject({
        requestsPerSec: 5,
        errorRatePercent: 0.5,
        p95LatencySeconds: 0.05
      });

      const rangeUrl = new URL(String(fetchMock.mock.calls[0][0]));
      expect(rangeUrl.searchParams.get("step")).toBe("60");
    });

    it("exports CSV for the 24h range", async () => {
      const response = await request(app)
        .get("/api/monitoring/export")
        .query({ format: "csv", range: "24h" })
        .set("Authorization", `Bearer ${managerToken()}`);

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/text\/csv/);
      expect(response.headers["content-disposition"]).toMatch(/toolshare-metrics-24h-.*\.csv/);
      expect(response.text).toContain("timestamp,requestsPerSec,errorRatePercent,p95LatencySeconds");
      expect(response.text).toContain("3.0000");

      const rangeUrl = new URL(String(fetchMock.mock.calls[0][0]));
      expect(rangeUrl.searchParams.get("step")).toBe("300");
    });

    it("uses a 7d window with coarser step", async () => {
      await request(app)
        .get("/api/monitoring/export")
        .query({ range: "7d" })
        .set("Authorization", `Bearer ${managerToken()}`);

      const rangeUrl = new URL(String(fetchMock.mock.calls[0][0]));
      expect(rangeUrl.searchParams.get("step")).toBe("1800");
      const start = Number(rangeUrl.searchParams.get("start"));
      const end = Number(rangeUrl.searchParams.get("end"));
      expect(end - start).toBe(7 * 86400);
    });
  });

  describe("access control", () => {
    it("requires authentication", async () => {
      const response = await request(app).get("/api/monitoring/overview");

      expect(response.status).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("requires MANAGER role", async () => {
      const response = await request(app)
        .get("/api/monitoring/overview")
        .set("Authorization", `Bearer ${userToken()}`);

      expect(response.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});