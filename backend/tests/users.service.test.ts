import { usersService } from "../src/modules/users/users.service";
import { usersRepository } from "../src/modules/users/users.repository";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/modules/users/users.repository", () => ({
  usersRepository: {
    findByIdPublic: vi.fn(),
    updateRole: vi.fn(),
    updateSuspension: vi.fn(),
    getSystemMetrics: vi.fn()
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
      isSuspended: false,
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
      isSuspended: false,
      createdAt: new Date()
    });

    mockedUsersRepository.updateRole.mockResolvedValueOnce({
      id: "user-1",
      email: "user@example.com",
      name: "User",
      address: "Street 1",
      role: "MODERATOR",
      isSuspended: false,
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

describe("usersService.updateSuspension", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws USER_NOT_FOUND when target user does not exist", async () => {
    mockedUsersRepository.findByIdPublic.mockResolvedValueOnce(null);

    await expect(
      usersService.updateSuspension({
        targetUserId: "missing-user-id",
        isSuspended: true
      })
    ).rejects.toMatchObject({
      code: "USER_NOT_FOUND",
      status: 404
    });

    expect(mockedUsersRepository.updateSuspension).not.toHaveBeenCalled();
  });

  it("blocks suspending a MANAGER account", async () => {
    mockedUsersRepository.findByIdPublic.mockResolvedValueOnce({
      id: "manager-1",
      email: "manager@example.com",
      name: "Manager",
      address: "Somewhere 1",
      role: "MANAGER",
      isSuspended: false,
      createdAt: new Date()
    });

    await expect(
      usersService.updateSuspension({
        targetUserId: "manager-1",
        isSuspended: true
      })
    ).rejects.toMatchObject({
      code: "INVALID_ACCOUNT_SUSPENSION",
      status: 400
    });

    expect(mockedUsersRepository.updateSuspension).not.toHaveBeenCalled();
  });

  it("updates suspension status when target user is not MANAGER", async () => {
    mockedUsersRepository.findByIdPublic.mockResolvedValueOnce({
      id: "user-1",
      email: "user@example.com",
      name: "User",
      address: "Street 1",
      role: "USER",
      isSuspended: false,
      createdAt: new Date()
    });

    mockedUsersRepository.updateSuspension.mockResolvedValueOnce({
      id: "user-1",
      email: "user@example.com",
      name: "User",
      address: "Street 1",
      role: "USER",
      isSuspended: true,
      createdAt: new Date()
    });

    const result = await usersService.updateSuspension({
      targetUserId: "user-1",
      isSuspended: true
    });

    expect(mockedUsersRepository.updateSuspension).toHaveBeenCalledWith("user-1", true);
    expect(result.isSuspended).toBe(true);
  });
});

describe("usersService.getAdminMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns current metrics", async () => {
    const current = {
      users: 15,
      tools: 22,
      workshops: 7,
      openBookings: 3,
      openReports: 2
    };

    mockedUsersRepository.getSystemMetrics.mockResolvedValueOnce(current);

    const result = await usersService.getAdminMetrics();

    expect(result).toEqual(current);
    expect(mockedUsersRepository.getSystemMetrics).toHaveBeenCalledTimes(1);
  });
});
