import { beforeEach, describe, expect, it, vi } from "vitest";
import { USER_NOTIFICATION_REQUESTED } from "../src/domain/events/notification.events";
import { notificationsRepository } from "../src/modules/notifications/repositories/notifications.repository";
import { pushService } from "../src/modules/notifications/services/push.service";
import { processOutboxEvent } from "../src/infrastructure/outbox/outbox.processor";
import { outboxRepository } from "../src/infrastructure/outbox/outbox.repository";

vi.mock("../src/modules/notifications/repositories/notifications.repository", () => ({
  notificationsRepository: {
    create: vi.fn()
  }
}));

vi.mock("../src/modules/notifications/services/push.service", () => ({
  pushService: {
    sendPushNotification: vi.fn()
  }
}));

vi.mock("../src/infrastructure/outbox/outbox.repository", () => ({
  outboxRepository: {
    hasDelivered: vi.fn(),
    recordDelivery: vi.fn()
  }
}));

const mockedNotificationsRepository = vi.mocked(notificationsRepository);
const mockedPushService = vi.mocked(pushService);
const mockedOutboxRepository = vi.mocked(outboxRepository);

describe("outbox processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedOutboxRepository.hasDelivered.mockResolvedValue(null);
    mockedOutboxRepository.recordDelivery.mockResolvedValue({ idempotencyKey: "key-1" } as any);
  });

  it("delivers in-app and push notification for user.notification.requested", async () => {
    await processOutboxEvent({
      id: "evt-1",
      eventType: USER_NOTIFICATION_REQUESTED,
      idempotencyKey: "booking:b1:tool-request:owner-1",
      payload: {
        userId: "owner-1",
        inAppMessage: "Neue Ausleihanfrage für dein Werkzeug.",
        pushTitle: "Neue Anfrage",
        pushBody: "Neue Ausleihanfrage für dein Werkzeug."
      }
    });

    expect(mockedNotificationsRepository.create).toHaveBeenCalledWith(
      "owner-1",
      "Neue Ausleihanfrage für dein Werkzeug."
    );
    expect(mockedPushService.sendPushNotification).toHaveBeenCalledWith(
      "owner-1",
      "Neue Anfrage",
      "Neue Ausleihanfrage für dein Werkzeug."
    );
    expect(mockedOutboxRepository.recordDelivery).toHaveBeenCalledWith("booking:b1:tool-request:owner-1");
  });

  it("skips push when pushTitle/pushBody are omitted (manager in-app only)", async () => {
    await processOutboxEvent({
      id: "evt-2",
      eventType: USER_NOTIFICATION_REQUESTED,
      idempotencyKey: "suspension-request:req-1:m1",
      payload: {
        userId: "m1",
        inAppMessage: "SPERRUNG_ANFRAGE: ..."
      }
    });

    expect(mockedNotificationsRepository.create).toHaveBeenCalled();
    expect(mockedPushService.sendPushNotification).not.toHaveBeenCalled();
  });

  it("is idempotent when delivery was already recorded", async () => {
    mockedOutboxRepository.hasDelivered.mockResolvedValueOnce({ idempotencyKey: "done" } as any);

    await processOutboxEvent({
      id: "evt-3",
      eventType: USER_NOTIFICATION_REQUESTED,
      idempotencyKey: "done",
      payload: {
        userId: "u1",
        inAppMessage: "Test",
        pushTitle: "T",
        pushBody: "B"
      }
    });

    expect(mockedNotificationsRepository.create).not.toHaveBeenCalled();
    expect(mockedPushService.sendPushNotification).not.toHaveBeenCalled();
  });
});