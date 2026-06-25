import { beforeEach, describe, expect, it, vi } from "vitest";
import { notificationsRepository } from "../src/modules/notifications/notifications.repository";

const mocks = vi.hoisted(() => ({
  notificationFindMany: vi.fn(),
  notificationUpdateMany: vi.fn(),
  notificationCreate: vi.fn()
}));

vi.mock("../src/config/prisma", () => ({
  prisma: {
    notification: {
      findMany: mocks.notificationFindMany,
      updateMany: mocks.notificationUpdateMany,
      create: mocks.notificationCreate
    }
  }
}));

describe("notificationsRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists notifications by user ordered by newest first", async () => {
    mocks.notificationFindMany.mockResolvedValueOnce([{ id: "n1" }]);

    const result = await notificationsRepository.listByUser("user-1", { limit: 100, offset: 0 });

    expect(mocks.notificationFindMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "desc" },
      take: 100,
      skip: 0
    });
    expect(result).toEqual([{ id: "n1" }]);
  });

  it("marks a notification as read for the owning user", async () => {
    mocks.notificationUpdateMany.mockResolvedValueOnce({ count: 1 });

    const result = await notificationsRepository.markAsRead("notification-1", "user-1");

    expect(mocks.notificationUpdateMany).toHaveBeenCalledWith({
      where: { id: "notification-1", userId: "user-1" },
      data: { read: true }
    });
    expect(result).toEqual({ count: 1 });
  });

  it("creates a notification entry", async () => {
    mocks.notificationCreate.mockResolvedValueOnce({ id: "n2", userId: "user-1", message: "Neu" });

    const result = await notificationsRepository.create("user-1", "Neue Nachricht");

    expect(mocks.notificationCreate).toHaveBeenCalledWith({
      data: { userId: "user-1", message: "Neue Nachricht" }
    });
    expect(result).toEqual({ id: "n2", userId: "user-1", message: "Neu" });
  });
});
