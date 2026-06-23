import { beforeEach, describe, expect, it, vi } from "vitest";
import { enqueueModerationNotification } from "../src/infrastructure/outbox/enqueue-user-notification";
import { notificationsRepository } from "../src/modules/notifications/notifications.repository";
import { suspensionRepository } from "../src/modules/users/suspension.repository";
import { notificationsService } from "../src/modules/notifications/notifications.service";

vi.mock("../src/infrastructure/outbox/enqueue-user-notification", () => ({
  enqueueModerationNotification: vi.fn(),
  newModerationNotificationKey: vi.fn(() => "moderation:key")
}));

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

const mockedEnqueueModerationNotification = vi.mocked(enqueueModerationNotification);
const mockedNotificationsRepository = vi.mocked(notificationsRepository);
const mockedSuspensionRepository = vi.mocked(suspensionRepository);

describe("notificationsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates warning messages with moderator name", async () => {
    await notificationsService.createWarning("user-1", "Unangemessene Sprache", "Lea");

    expect(mockedEnqueueModerationNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        inAppMessage: expect.stringContaining("ERMAHNUNG: Unangemessene Sprache"),
        pushTitle: "System-Ermahnung"
      })
    );
    expect(mockedEnqueueModerationNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        inAppMessage: expect.stringContaining("Moderator: Lea")
      })
    );
  });

  it("notifies all managers about suspension requests", async () => {
    mockedSuspensionRepository.listManagerIds.mockResolvedValueOnce([
      { id: "m1" },
      { id: "m2" }
    ] as any);

    await notificationsService.notifyManagersSuspensionRequest("req-1", "Max", "Spam");

    expect(mockedEnqueueModerationNotification).toHaveBeenCalledTimes(2);
    expect(mockedEnqueueModerationNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "m1",
        inAppMessage: expect.stringContaining("SPERRUNG_ANFRAGE")
      })
    );
  });

  it("creates suspension notice and rejects unknown markAsRead", async () => {
    await notificationsService.createSuspensionNotice("user-2", "Verstoß gegen Regeln");
    expect(mockedEnqueueModerationNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-2",
        inAppMessage: expect.stringContaining("SPERRUNG:")
      })
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
