import jwt from "jsonwebtoken";
import request from "supertest";
import type { Express } from "express";
import { usersRepository } from "../src/modules/users/users.repository";

jest.mock("../src/modules/users/users.repository", () => ({
  usersRepository: {
    findByIdPublic: jest.fn(),
    updateRole: jest.fn()
  }
}));

const mockedUsersRepository = usersRepository as jest.Mocked<typeof usersRepository>;

const MANAGER_ACTOR_ID = "11111111-1111-1111-1111-111111111111";
const TARGET_MANAGER_ID = "22222222-2222-2222-2222-222222222222";
const TARGET_USER_ID = "33333333-3333-3333-3333-333333333333";

describe("PATCH /api/users/:id/role integration", () => {
  let app: Express;

  beforeAll(async () => {
    process.env.DATABASE_URL ??= "postgresql://toolshare:toolshare@localhost:5432/toolshare_test";
    process.env.JWT_SECRET ??= "test-secret";

    const appModule = await import("../src/app");
    app = appModule.createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const managerToken = () =>
    jwt.sign(
      {
        userId: MANAGER_ACTOR_ID,
        role: "MANAGER"
      },
      process.env.JWT_SECRET as string
    );

  it("blocks downgrading a target user that is already MANAGER", async () => {
    mockedUsersRepository.findByIdPublic.mockResolvedValueOnce({
      id: TARGET_MANAGER_ID,
      email: "manager@example.com",
      name: "Manager",
      address: "Main Street 1",
      role: "MANAGER",
      createdAt: new Date()
    });

    const response = await request(app)
      .patch(`/api/users/${TARGET_MANAGER_ID}/role`)
      .set("Authorization", `Bearer ${managerToken()}`)
      .send({ role: "USER" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "INVALID_ROLE_CHANGE",
        status: 400
      }
    });
    expect(mockedUsersRepository.updateRole).not.toHaveBeenCalled();
  });

  it("updates role when target user is not MANAGER", async () => {
    mockedUsersRepository.findByIdPublic.mockResolvedValueOnce({
      id: TARGET_USER_ID,
      email: "user@example.com",
      name: "User",
      address: "Main Street 2",
      role: "USER",
      createdAt: new Date()
    });

    mockedUsersRepository.updateRole.mockResolvedValueOnce({
      id: TARGET_USER_ID,
      email: "user@example.com",
      name: "User",
      address: "Main Street 2",
      role: "MODERATOR",
      createdAt: new Date()
    });

    const response = await request(app)
      .patch(`/api/users/${TARGET_USER_ID}/role`)
      .set("Authorization", `Bearer ${managerToken()}`)
      .send({ role: "MODERATOR" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: TARGET_USER_ID,
      role: "MODERATOR"
    });
    expect(mockedUsersRepository.updateRole).toHaveBeenCalledWith(TARGET_USER_ID, "MODERATOR");
  });

  it("rejects request when caller is not MANAGER", async () => {
    const moderatorToken = jwt.sign(
      {
        userId: MANAGER_ACTOR_ID,
        role: "MODERATOR"
      },
      process.env.JWT_SECRET as string
    );

    const response = await request(app)
      .patch(`/api/users/${TARGET_USER_ID}/role`)
      .set("Authorization", `Bearer ${moderatorToken}`)
      .send({ role: "MODERATOR" });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      error: {
        code: "FORBIDDEN",
        status: 403
      }
    });
    expect(mockedUsersRepository.findByIdPublic).not.toHaveBeenCalled();
  });
});
