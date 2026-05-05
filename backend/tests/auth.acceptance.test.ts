import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";

const app = createApp();

describe("US-13 Authentication acceptance criteria", () => {
  const seed = Date.now();
  const validEmail = `us13-valid-${seed}@example.com`;
  const validPassword = "Test1234!";
  const blockedEmail = `us13-blocked-${seed}@example.com`;
  const blockedPassword = "Blocked1234!";

  beforeAll(async () => {
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
      data: { isBlocked: true }
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

  it("rejects invalid credentials and keeps user logged out", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: validEmail,
      password: "WrongPass123"
    });

    expect(response.status).toBe(401);
    expect(response.body.error?.code).toBe("INVALID_CREDENTIALS");
  });

  it("requires login for protected bookings route", async () => {
    const response = await request(app).get("/api/bookings/me");

    expect(response.status).toBe(401);
    expect(response.body.error?.code).toBe("UNAUTHORIZED");
  });

  it("rejects login for blocked accounts", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: blockedEmail,
      password: blockedPassword
    });

    expect(response.status).toBe(403);
    expect(response.body.error?.code).toBe("ACCOUNT_BLOCKED");
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
