import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";

async function isDatabaseAvailable() {
  try {
    const { prisma } = await import("../src/config/prisma");
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)("US-13 Authentication acceptance criteria", () => {
  const seed = Date.now();
  const validEmail = `us13-valid-${seed}@example.com`;
  const validPassword = "Test1234!";
  const blockedEmail = `us13-blocked-${seed}@example.com`;
  const blockedPassword = "Blocked1234!";

  let app: Express;
  let prisma: typeof import("../src/config/prisma").prisma;

  beforeAll(async () => {
    const appModule = await import("../src/app");
    const prismaModule = await import("../src/config/prisma");
    app = appModule.createApp();
    prisma = prismaModule.prisma;

    await request(app).post("/api/auth/register").send({
      email: validEmail,
      password: validPassword,
      name: "Valid User",
      address: "Valid Street 1"
    });

    await request(app).post("/api/auth/register").send({
      email: blockedEmail,
      password: blockedPassword,
      name: "Blocked User",
      address: "Blocked Street 1"
    });

    await prisma.user.update({
      where: { email: blockedEmail },
      data: { isSuspended: true }
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [validEmail, blockedEmail]
        }
      }
    });
    await prisma.$disconnect();
  });

  it("logs in with valid credentials", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: validEmail,
      password: validPassword
    });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBeTypeOf("string");
    expect(response.body.user?.email).toBe(validEmail);
  });

  it("issues JWT usable for protected endpoints", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: validEmail,
      password: validPassword
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.accessToken).toBeTypeOf("string");

    const protectedResponse = await request(app)
      .get("/api/bookings/me")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken as string}`);

    expect(protectedResponse.status).toBe(200);
    expect(Array.isArray(protectedResponse.body)).toBe(true);
  });

  it("rejects invalid credentials and keeps user logged out", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: validEmail,
      password: "WrongPass123"
    });

    expect(response.status).toBe(401);
    expect(response.body.error?.code).toBe("INVALID_CREDENTIALS");
    expect(response.body.accessToken).toBeUndefined();
  });

  it("requires login for protected bookings route", async () => {
    const response = await request(app).get("/api/bookings/me");

    expect(response.status).toBe(401);
    expect(response.body.error?.code).toBe("UNAUTHORIZED");
  });

  it("rejects login for suspended accounts", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: blockedEmail,
      password: blockedPassword
    });

    expect(response.status).toBe(403);
    expect(response.body.error?.code).toBe("ACCOUNT_SUSPENDED");
  });

  it("validates minimum password length on registration", async () => {
    const response = await request(app).post("/api/auth/register").send({
      email: `short-pass-${seed}@example.com`,
      password: "short",
      name: "Short Pass",
      address: "Validation Street 3"
    });

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("VALIDATION_ERROR");
    expect(response.body.error?.details?.fieldErrors?.body?.[0]).toContain("at least 8 character");
  });

  it("always creates newly registered users with USER role", async () => {
    const email = `role-check-${seed}@example.com`;
    const response = await request(app).post("/api/auth/register").send({
      email,
      password: "RoleCheck123!",
      name: "Role Check",
      address: "Role Street 9",
      role: "MANAGER"
    });

    expect(response.status).toBe(201);
    expect(response.body.user?.role).toBe("USER");

    await prisma.user.delete({ where: { email } });
  });
});
