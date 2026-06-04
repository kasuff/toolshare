import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { metricsMiddleware } from "../src/middleware/metrics.middleware";
import {
  httpRequestsTotal,
  httpRequestDurationSeconds,
  httpRequestSizeBytes
} from "../src/utils/metrics";

vi.mock("../src/utils/metrics", () => ({
  httpRequestsTotal: { inc: vi.fn() },
  httpRequestDurationSeconds: { observe: vi.fn() },
  httpRequestSizeBytes: { observe: vi.fn() },
  activeUsersGauge: { set: vi.fn() }
}));

const mockedTotal = vi.mocked(httpRequestsTotal);
const mockedDuration = vi.mocked(httpRequestDurationSeconds);
const mockedSize = vi.mocked(httpRequestSizeBytes);

function buildReq(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    path: "/api/tools",
    baseUrl: "",
    headers: {},
    ip: "127.0.0.1",
    route: undefined,
    ...overrides
  } as unknown as Request;
}

function buildRes(): Response & { _finish: () => void } {
  const listeners: Record<string, (() => void)[]> = {};
  const res = {
    statusCode: 200,
    on(event: string, cb: () => void) {
      (listeners[event] ??= []).push(cb);
    },
    _finish() {
      (listeners["finish"] ?? []).forEach((cb) => cb());
    }
  };
  return res as unknown as Response & { _finish: () => void };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("metricsMiddleware", () => {
  it("calls next()", () => {
    const req = buildReq();
    const res = buildRes();
    const next = vi.fn();
    metricsMiddleware(req, res as Response, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("increments httpRequestsTotal on response finish", () => {
    const req = buildReq({ method: "GET", path: "/api/tools" });
    const res = buildRes();
    res.statusCode = 200;
    metricsMiddleware(req, res as Response, vi.fn());
    res._finish();
    expect(mockedTotal.inc).toHaveBeenCalledOnce();
    const [incLabels] = mockedTotal.inc.mock.calls[0] as any[];
    expect(incLabels).toMatchObject({ method: "GET", status_code: "200" });
  });

  it("observes httpRequestDurationSeconds on finish", () => {
    const req = buildReq();
    const res = buildRes();
    metricsMiddleware(req, res as Response, vi.fn());
    res._finish();
    expect(mockedDuration.observe).toHaveBeenCalledOnce();
    const [labels, duration] = mockedDuration.observe.mock.calls[0] as any[];
    expect(labels).toHaveProperty("method", "GET");
    expect(typeof duration).toBe("number");
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it("does not observe httpRequestSizeBytes when content-length is absent", () => {
    const req = buildReq({ headers: {} });
    const res = buildRes();
    metricsMiddleware(req, res as Response, vi.fn());
    res._finish();
    expect(mockedSize.observe).not.toHaveBeenCalled();
  });

  it("observes httpRequestSizeBytes when content-length is present", () => {
    const req = buildReq({ headers: { "content-length": "512" } });
    const res = buildRes();
    metricsMiddleware(req, res as Response, vi.fn());
    res._finish();
    expect(mockedSize.observe).toHaveBeenCalledOnce();
    const [, bytes] = mockedSize.observe.mock.calls[0] as any[];
    expect(bytes).toBe(512);
  });

  it("normalizes numeric path segments to :id", () => {
    const req = buildReq({ method: "GET", path: "/users/42/tools" });
    const res = buildRes();
    res.statusCode = 200;
    metricsMiddleware(req, res as Response, vi.fn());
    res._finish();
    const [labels] = mockedTotal.inc.mock.calls[0] as any[];
    expect(labels.route).toBe("/users/:id/tools");
  });

  it("normalizes UUIDs in path to :uuid", () => {
    const req = buildReq({
      method: "DELETE",
      path: "/tools/aabbccdd-eeff-aabb-ccdd-eeffaabbccdd"
    });
    const res = buildRes();
    metricsMiddleware(req, res as Response, vi.fn());
    res._finish();
    const [labels] = mockedTotal.inc.mock.calls[0] as any[];
    expect(labels.route).toBe("/tools/:uuid");
  });

  it("uses req.route.path + baseUrl when route is resolved", () => {
    const req = buildReq({
      method: "GET",
      path: "/tools/99",
      baseUrl: "/api",
      route: { path: "/tools/:id" } as Request["route"]
    });
    const res = buildRes();
    metricsMiddleware(req, res as Response, vi.fn());
    res._finish();
    const [labels] = mockedTotal.inc.mock.calls[0] as any[];
    expect(labels.route).toBe("/api/tools/:id");
  });
});
