import { beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

const METRICS_BODY = `# HELP http_requests_total Total HTTP requests\n# TYPE http_requests_total counter\nhttp_requests_total 0\n`;

vi.mock("../src/utils/metrics", () => ({
  metricsRegistry: {
    contentType: "text/plain; version=0.0.4; charset=utf-8",
    metrics: vi.fn().mockResolvedValue(METRICS_BODY)
  },
  httpRequestsTotal: { inc: vi.fn() },
  httpRequestDurationSeconds: { observe: vi.fn() },
  httpRequestSizeBytes: { observe: vi.fn() },
  activeUsersGauge: { set: vi.fn() },
  userRegistrationsTotal: { inc: vi.fn() },
  userLoginsTotal: { inc: vi.fn() },
  bookingsCreatedTotal: { inc: vi.fn() },
  toolsListedGauge: { set: vi.fn() },
  collectDefaultMetrics: vi.fn()
}));

describe("GET /metrics", () => {
  let app: Express;

  beforeAll(async () => {
    process.env.JWT_SECRET ??= "test-secret";
    process.env.DATABASE_URL ??= "postgresql://toolshare:toolshare@localhost:5432/toolshare_test";
    const { createApp } = await import("../src/app");
    app = createApp();
  });

  it("returns 200", async () => {
    const res = await request(app).get("/metrics");
    expect(res.status).toBe(200);
  });

  it("returns prometheus content-type", async () => {
    const res = await request(app).get("/metrics");
    expect(res.headers["content-type"]).toMatch(/text\/plain/);
  });

  it("returns prometheus metrics body", async () => {
    const res = await request(app).get("/metrics");
    expect(res.text).toBe(METRICS_BODY);
  });

  it("is not behind the /api rate limiter", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get("/metrics");
      expect(res.status).not.toBe(429);
    }
  });
});