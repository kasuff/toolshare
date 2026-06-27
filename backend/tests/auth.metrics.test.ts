import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

vi.mock("../src/modules/auth/services/auth.service", () => ({
  authService: {
    register: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn()
  }
}));

vi.mock("../src/utils/metrics", () => ({
  metricsRegistry: {
    contentType: "text/plain",
    metrics: vi.fn().mockResolvedValue("")
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

import { authService } from "../src/modules/auth/services/auth.service";
import { userRegistrationsTotal, userLoginsTotal } from "../src/utils/metrics";

const mockedAuthService = vi.mocked(authService);
const mockedRegistrations = vi.mocked(userRegistrationsTotal);
const mockedLogins = vi.mocked(userLoginsTotal);

describe("auth controller – metrics instrumentation", () => {
  let app: Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.JWT_SECRET ??= "test-secret";
    process.env.DATABASE_URL ??= "postgresql://toolshare:toolshare@localhost:5432/toolshare_test";
    const { createApp } = await import("../src/app");
    app = createApp();
  });

  describe("POST /api/auth/register", () => {
    it("increments userRegistrationsTotal on successful registration", async () => {
      mockedAuthService.register.mockResolvedValue({
        user: { id: "1", email: "a@b.com", role: "USER", name: "Test" },
        accessToken: "tok",
        refreshToken: "rtok"
      } as never);

      await request(app).post("/api/auth/register").send({
        email: "a@b.com",
        password: "Test1234!",
        name: "Test",
        address: "Musterstr. 1"
      });

      expect(mockedRegistrations.inc).toHaveBeenCalledOnce();
    });

    it("does not increment userRegistrationsTotal when service throws", async () => {
      mockedAuthService.register.mockRejectedValue(new Error("email taken"));

      await request(app).post("/api/auth/register").send({ email: "x@y.com" });

      expect(mockedRegistrations.inc).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/auth/login", () => {
    it("increments userLoginsTotal with status=success on successful login", async () => {
      mockedAuthService.login.mockResolvedValue({
        user: { id: "1", email: "a@b.com", role: "USER", name: "Test" },
        accessToken: "tok",
        refreshToken: "rtok"
      } as never);

      await request(app)
        .post("/api/auth/login")
        .send({ email: "a@b.com", password: "Test1234!" });

      expect(mockedLogins.inc).toHaveBeenCalledWith({ status: "success" });
    });

    it("increments userLoginsTotal with status=failed when login throws", async () => {
      mockedAuthService.login.mockRejectedValue(new Error("invalid credentials"));

      await request(app)
        .post("/api/auth/login")
        .send({ email: "a@b.com", password: "WrongPass1!" });

      expect(mockedLogins.inc).toHaveBeenCalledWith({ status: "failed" });
    });

    it("does not increment success when login fails", async () => {
      mockedAuthService.login.mockRejectedValue(new Error("invalid credentials"));

      await request(app)
        .post("/api/auth/login")
        .send({ email: "a@b.com", password: "WrongPass1!" });

      expect(mockedLogins.inc).not.toHaveBeenCalledWith({ status: "success" });
    });
  });
});