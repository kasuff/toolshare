import { usersService } from "../src/modules/users/users.service";
import { usersRepository } from "../src/modules/users/users.repository";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/modules/users/users.repository", () => ({
  usersRepository: {
    findByIdPublic: vi.fn(),
    updateRole: vi.fn()
  }
}));

const mockedUsersRepository = vi.mocked(usersRepository);

describe("usersService.updateRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws USER_NOT_FOUND when target user does not exist", async () => {
    mockedUsersRepository.findByIdPublic.mockResolvedValueOnce(null);

    await expect(
      usersService.updateRole({
        targetUserId: "missing-user-id",
        role: "MODERATOR",
        actorId: "manager-id"
      })
    ).rejects.toMatchObject({
      code: "USER_NOT_FOUND",
      status: 404
    });

    expect(mockedUsersRepository.updateRole).not.toHaveBeenCalled();
  });

  it("blocks downgrading a user that is already MANAGER", async () => {
    mockedUsersRepository.findByIdPublic.mockResolvedValueOnce({
      id: "manager-1",
      email: "manager@example.com",
      name: "Manager",
      address: "Somewhere 1",
      role: "MANAGER",
      createdAt: new Date()
    });

    await expect(
      usersService.updateRole({
        targetUserId: "manager-1",
        role: "USER",
        actorId: "another-manager"
      })
    ).rejects.toMatchObject({
      code: "INVALID_ROLE_CHANGE",
      status: 400
    });

    expect(mockedUsersRepository.updateRole).not.toHaveBeenCalled();
  });

  it("updates role when target user is not MANAGER", async () => {
    mockedUsersRepository.findByIdPublic.mockResolvedValueOnce({
      id: "user-1",
      email: "user@example.com",
      name: "User",
      address: "Street 1",
      role: "USER",
      createdAt: new Date()
    });

    mockedUsersRepository.updateRole.mockResolvedValueOnce({
      id: "user-1",
      email: "user@example.com",
      name: "User",
      address: "Street 1",
      role: "MODERATOR",
      createdAt: new Date()
    });

    const result = await usersService.updateRole({
      targetUserId: "user-1",
      role: "MODERATOR",
      actorId: "manager-1"
    });

    expect(mockedUsersRepository.updateRole).toHaveBeenCalledWith("user-1", "MODERATOR");
    expect(result.role).toBe("MODERATOR");
  });
});
