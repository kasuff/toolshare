import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("rate limiting", () => {
  afterEach(() => {
    vi.resetModules();
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.RATE_LIMIT_AUTH_MAX;
    delete process.env.RATE_LIMIT_WINDOW_MS;
  });

  it("returns 429 when the global API limit is exceeded", async () => {
    process.env.RATE_LIMIT_MAX = "2";
    process.env.RATE_LIMIT_AUTH_MAX = "100";
    process.env.RATE_LIMIT_WINDOW_MS = "60000";
    process.env.DATABASE_URL ??= "postgresql://toolshare:toolshare@localhost:5432/toolshare_test";
    process.env.JWT_SECRET ??= "test-secret";

    const { createApp } = await import("../src/app");
    const app = createApp();

    await request(app).get("/api/tools");
    await request(app).get("/api/tools");
    const limited = await request(app).get("/api/tools");

    expect(limited.status).toBe(429);
    expect(limited.body.message).toMatch(/too many requests/i);
  });

  it("returns 429 when the auth limit is exceeded", async () => {
    process.env.RATE_LIMIT_MAX = "1000";
    process.env.RATE_LIMIT_AUTH_MAX = "2";
    process.env.RATE_LIMIT_WINDOW_MS = "60000";
    process.env.DATABASE_URL ??= "postgresql://toolshare:toolshare@localhost:5432/toolshare_test";
    process.env.JWT_SECRET ??= "test-secret";

    const { createApp } = await import("../src/app");
    const app = createApp();

    const payload = {
      email: "rate-limit@example.com",
      password: "Test1234!",
      name: "Rate Limit",
      address: "Test Street 1"
    };

    await request(app).post("/api/auth/register").send(payload);
    await request(app).post("/api/auth/register").send({
      ...payload,
      email: "rate-limit-2@example.com"
    });
    const limited = await request(app).post("/api/auth/login").send({
      email: payload.email,
      password: payload.password
    });

    expect(limited.status).toBe(429);
    expect(limited.body.message).toMatch(/authentication attempts/i);
  });
});
