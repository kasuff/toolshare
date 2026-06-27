import { usersService } from "../src/modules/users/services/users.service";
import { usersRepository } from "../src/modules/users/repositories/users.repository";
import { notificationsService } from "../src/modules/notifications/services/notifications.service";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/modules/users/repositories/users.repository", () => ({
  usersRepository: {
    findByIdPublic: vi.fn(),
    updateProfile: vi.fn(),
    listPublic: vi.fn(),
    updateRole: vi.fn(),
    updateSuspension: vi.fn(),
    getSystemMetrics: vi.fn()
  }
}));

vi.mock("../src/modules/notifications/services/notifications.service", () => ({
  notificationsService: {
    createSuspensionNotice: vi.fn()
  }
}));

vi.mock("../src/modules/address/services/address.service", () => ({
  addressService: {
    geocode: vi.fn().mockResolvedValue({ latitude: 48.137154, longitude: 11.576124 })
  }
}));

const mockedUsersRepository = vi.mocked(usersRepository);
const mockedNotificationsService = vi.mocked(notificationsService);

const sampleUser = {
  id: "user-1",
  email: "user@example.com",
  name: "User",
  address: "Street 1",
  role: "USER" as const,
  isSuspended: false,
  createdAt: new Date()
};

describe("usersService profile endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists users with filters", async () => {
    mockedUsersRepository.listPublic.mockResolvedValueOnce([sampleUser] as any);

    const result = await usersService.listUsers({ role: "USER", search: "lea" });

    expect(mockedUsersRepository.listPublic).toHaveBeenCalledWith({ role: "USER", search: "lea" });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "user-1", email: "user@example.com", role: "USER" });
    expect(result[0].createdAt).toBeInstanceOf(Date);
  });

  it("returns profile and rejects missing users", async () => {
    mockedUsersRepository.findByIdPublic.mockResolvedValueOnce(sampleUser as any);
    await expect(usersService.getMyProfile("user-1")).resolves.toMatchObject({
      id: "user-1",
      email: "user@example.com",
      name: "User"
    });

    mockedUsersRepository.findByIdPublic.mockResolvedValueOnce(null);
    await expect(usersService.getById("missing")).rejects.toMatchObject({ code: "USER_NOT_FOUND", status: 404 });
  });

  it("updates profile when user exists", async () => {
    mockedUsersRepository.findByIdPublic.mockResolvedValueOnce(sampleUser as any);
    mockedUsersRepository.updateProfile.mockResolvedValueOnce({ ...sampleUser, name: "Lea Neu" } as any);

    const result = await usersService.updateMyProfile({
      userId: "user-1",
      name: "Lea Neu",
      address: "Neue Straße 1"
    });

    // Beim Adresswechsel geocodet der Service und reicht zusätzlich
    // latitude/longitude (und expoPushToken) an das Repository durch.
    expect(mockedUsersRepository.updateProfile).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        name: "Lea Neu",
        address: "Neue Straße 1"
      })
    );
    expect(result.name).toBe("Lea Neu");
  });
});

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
    mockedNotificationsService.createSuspensionNotice.mockResolvedValueOnce({ id: "n1" } as any);

    const result = await usersService.updateSuspension({
      targetUserId: "user-1",
      isSuspended: true
    });

    expect(mockedUsersRepository.updateSuspension).toHaveBeenCalledWith("user-1", true);
    expect(mockedNotificationsService.createSuspensionNotice).toHaveBeenCalledWith(
      "user-1",
      "Dein Konto wurde von der Administration gesperrt."
    );
    expect(result.isSuspended).toBe(true);
  });

  it("does not send suspension notice when user is already suspended", async () => {
    mockedUsersRepository.findByIdPublic.mockResolvedValueOnce({
      id: "user-1",
      email: "user@example.com",
      name: "User",
      address: "Street 1",
      role: "USER",
      isSuspended: true,
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

    await usersService.updateSuspension({
      targetUserId: "user-1",
      isSuspended: true
    });

    expect(mockedNotificationsService.createSuspensionNotice).not.toHaveBeenCalled();
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