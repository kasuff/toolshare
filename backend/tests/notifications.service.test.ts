import { beforeEach, describe, expect, it, vi } from "vitest";
import { notificationsRepository } from "../src/modules/notifications/notifications.repository";
import { suspensionRepository } from "../src/modules/users/suspension.repository";
import { notificationsService } from "../src/modules/notifications/notifications.service";

vi.mock("../src/modules/notifications/notifications.repository", () => ({
  notificationsRepository: {
    listByUser: vi.fn(),
    markAsRead: vi.fn(),
    create: vi.fn()
  }
}));

vi.mock("../src/modules/users/suspension.repository", () => ({
  suspensionRepository: {
    listManagerIds: vi.fn()
  }
}));

const mockedNotificationsRepository = vi.mocked(notificationsRepository);
const mockedSuspensionRepository = vi.mocked(suspensionRepository);

describe("notificationsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates warning messages with moderator name", async () => {
    mockedNotificationsRepository.create.mockResolvedValueOnce({ id: "n1" } as any);

    await notificationsService.createWarning("user-1", "Unangemessene Sprache", "Lea");

    expect(mockedNotificationsRepository.create).toHaveBeenCalledWith(
      "user-1",
      expect.stringContaining("ERMAHNUNG: Unangemessene Sprache")
    );
    expect(mockedNotificationsRepository.create).toHaveBeenCalledWith(
      "user-1",
      expect.stringContaining("Moderator: Lea")
    );
  });

  it("notifies all managers about suspension requests", async () => {
    mockedSuspensionRepository.listManagerIds.mockResolvedValueOnce([
      { id: "m1" },
      { id: "m2" }
    ] as any);
    mockedNotificationsRepository.create.mockResolvedValue({ id: "n1" } as any);

    await notificationsService.notifyManagersSuspensionRequest("req-1", "Max", "Spam");

    expect(mockedNotificationsRepository.create).toHaveBeenCalledTimes(2);
    expect(mockedNotificationsRepository.create).toHaveBeenCalledWith(
      "m1",
      expect.stringContaining("SPERRUNG_ANFRAGE")
    );
  });

  it("creates suspension notice and rejects unknown markAsRead", async () => {
    mockedNotificationsRepository.create.mockResolvedValueOnce({ id: "n2" } as any);
    await notificationsService.createSuspensionNotice("user-2", "Verstoß gegen Regeln");
    expect(mockedNotificationsRepository.create).toHaveBeenCalledWith(
      "user-2",
      expect.stringContaining("SPERRUNG:")
    );

    mockedNotificationsRepository.markAsRead.mockResolvedValueOnce({ count: 0 } as any);
    await expect(notificationsService.markAsRead("user-2", "missing")).rejects.toMatchObject({
      code: "NOTIFICATION_NOT_FOUND",
      status: 404
    });

    mockedNotificationsRepository.markAsRead.mockResolvedValueOnce({ count: 1 } as any);
    await expect(notificationsService.markAsRead("user-2", "n2")).resolves.toBeUndefined();
  });
});
