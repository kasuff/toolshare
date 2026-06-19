import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";
import { authRepository } from "../src/modules/auth/auth.repository";
import { bookingsRepository } from "../src/modules/bookings/bookings.repository";

vi.mock("../src/modules/auth/auth.repository", () => ({
  authRepository: {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    createUser: vi.fn()
  }
}));

vi.mock("../src/modules/bookings/bookings.repository", () => ({
  bookingsRepository: {
    listForUserContext: vi.fn()
  }
}));

const mockedAuthRepository = vi.mocked(authRepository);
const mockedBookingsRepository = vi.mocked(bookingsRepository);

type MockUser = {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  address: string;
  role: "USER" | "MODERATOR" | "MANAGER";
  isSuspended: boolean;
  createdAt: Date;
};
describe("US-13 Authentication acceptance criteria", () => {
  const seed = Date.now();
  const validEmail = `us13-valid-${seed}@example.com`;
  const validPassword = "Test1234!";
  const blockedEmail = `us13-blocked-${seed}@example.com`;
  const blockedPassword = "Blocked1234!";
  let usersByEmail = new Map<string, MockUser>();
  let app: Express;

  beforeAll(async () => {
    process.env.DATABASE_URL ??= "postgresql://toolshare:toolshare@localhost:5432/toolshare_test";
    process.env.JWT_SECRET ??= "test-secret";

    const appModule = await import("../src/app");
    app = appModule.createApp();
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const validPasswordHash = await bcrypt.hash(validPassword, 4);
    const blockedPasswordHash = await bcrypt.hash(blockedPassword, 4);

    usersByEmail = new Map<string, MockUser>([
      [
        validEmail,
        {
          id: "11111111-1111-1111-1111-111111111111",
          email: validEmail,
          passwordHash: validPasswordHash,
          name: "Valid User",
          address: "Valid Street 1",
          role: "USER",
          isSuspended: false,
          createdAt: new Date()
        }
      ],
      [
        blockedEmail,
        {
          id: "22222222-2222-2222-2222-222222222222",
          email: blockedEmail,
          passwordHash: blockedPasswordHash,
          name: "Blocked User",
          address: "Blocked Street 1",
          role: "USER",
          isSuspended: true,
          createdAt: new Date()
        }
      ]
    ]);

    mockedAuthRepository.findByEmail.mockImplementation(async (email) => usersByEmail.get(email) ?? null);
    mockedAuthRepository.findById.mockImplementation(async (id) => {
      const user = Array.from(usersByEmail.values()).find((entry) => entry.id === id);
      if (!user) return null;
      return {
        id: user.id,
        role: user.role,
        isSuspended: user.isSuspended
      };
    });
    mockedAuthRepository.createUser.mockImplementation(async (input) => {
      const created: MockUser = {
        id: `created-${usersByEmail.size + 1}`,
        email: input.email,
        passwordHash: input.passwordHash,
        name: input.name,
        address: input.address,
        role: input.role,
        isSuspended: false,
        createdAt: new Date()
      };
      usersByEmail.set(created.email, created);
      return created;
    });
    mockedBookingsRepository.listForUserContext.mockResolvedValue([]);
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

  it("rejects protected requests for suspended accounts with a valid token", async () => {
    mockedAuthRepository.findById.mockResolvedValueOnce({
      id: "11111111-1111-1111-1111-111111111111",
      role: "USER",
      isSuspended: true
    });

    const token = jwt.sign(
      {
        userId: "11111111-1111-1111-1111-111111111111",
        role: "USER"
      },
      process.env.JWT_SECRET as string
    );

    const response = await request(app)
      .get("/api/bookings/me")
      .set("Authorization", `Bearer ${token}`);

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

  it("rejects registration when address misses a house number", async () => {
    const response = await request(app).post("/api/auth/register").send({
      email: `no-house-${seed}@example.com`,
      password: "ValidPass123!",
      name: "No House",
      address: "Musterstraße"
    });

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("VALIDATION_ERROR");
    expect(response.body.error?.details?.fieldErrors?.body?.[0]).toContain("Hausnummer");
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
  });
});
