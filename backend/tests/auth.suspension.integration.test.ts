import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import type { Express } from "express";
import { authRepository } from "../src/modules/auth/auth.repository";
import { usersRepository } from "../src/modules/users/users.repository";

vi.mock("../src/modules/auth/auth.repository", () => ({
  authRepository: {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    createUser: vi.fn()
  }
}));

vi.mock("../src/modules/users/users.repository", () => ({
  usersRepository: {
    findByIdPublic: vi.fn(),
    listPublic: vi.fn(),
    updateProfile: vi.fn(),
    updateRole: vi.fn(),
    updateSuspension: vi.fn()
  }
}));

const mockedAuthRepository = vi.mocked(authRepository);
const mockedUsersRepository = vi.mocked(usersRepository);

describe.skip("Auth + suspension integration", () => {
  let app: Express;

  beforeAll(async () => {
    process.env.DATABASE_URL ??= "postgresql://toolshare:toolshare@localhost:5432/toolshare_test";
    process.env.JWT_SECRET ??= "test-secret";

    const appModule = await import("../src/app");
    app = appModule.createApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies login for suspended users", async () => {
    mockedAuthRepository.findByEmail.mockResolvedValueOnce({
      id: "11111111-1111-1111-1111-111111111111",
      email: "suspended@example.com",
      passwordHash: "hash",
      name: "Suspended",
      address: "Main Street 1",
      role: "USER",
      isSuspended: true,
      createdAt: new Date()
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "suspended@example.com",
      password: "password123"
    });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      error: {
        code: "ACCOUNT_SUSPENDED",
        status: 403
      }
    });
  });

  it("denies protected actions for suspended users with valid token", async () => {
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

    const response = await request(app).get("/api/users/me").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      error: {
        code: "ACCOUNT_SUSPENDED",
        status: 403
      }
    });
    expect(mockedUsersRepository.findByIdPublic).not.toHaveBeenCalled();
  });
});
