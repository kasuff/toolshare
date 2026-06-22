import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  outboxCount: vi.fn()
}));

vi.mock("../src/config/prisma", () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
    outboxEvent: {
      count: mocks.outboxCount
    }
  }
}));

describe("health endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mocks.outboxCount.mockResolvedValue(0);
  });

  it("returns liveness on GET /health", async () => {
    const app = createApp();
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("returns ready when database is reachable", async () => {
    const app = createApp();
    const response = await request(app).get("/health/ready");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "ready",
      checks: { database: "ok" }
    });
    expect(response.headers["x-request-id"]).toBeTruthy();
  });

  it("returns 503 when database is down", async () => {
    mocks.queryRaw.mockRejectedValueOnce(new Error("connection refused"));
    const app = createApp();
    const response = await request(app).get("/health/ready");
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: "not_ready",
      checks: { database: "fail" }
    });
  });

  it("propagates x-request-id on API errors", async () => {
    const app = createApp();
    const response = await request(app)
      .get("/api/tools/not-a-uuid")
      .set("x-request-id", "test-req-123");
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.headers["x-request-id"]).toBe("test-req-123");
  });
});
