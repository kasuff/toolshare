import {
  USER_NOTIFICATION_REQUESTED,
  type UserNotificationPayload
} from "../../domain/events/notification.events";
import { notificationsRepository } from "../../modules/notifications/notifications.repository";
import { pushService } from "../../modules/notifications/push.service";
import { publishInboxChanged } from "../../modules/inbox/inbox.events";
import { outboxRepository } from "./outbox.repository";

type OutboxRow = {
  id: string;
  eventType: string;
  payload: unknown;
  idempotencyKey: string;
};

async function handleUserNotification(payload: UserNotificationPayload, idempotencyKey: string) {
  const alreadyDelivered = await outboxRepository.hasDelivered(idempotencyKey);
  if (alreadyDelivered) {
    return;
  }

  await notificationsRepository.create(payload.userId, payload.inAppMessage);
  if (payload.pushTitle && payload.pushBody) {
    await pushService.sendPushNotification(payload.userId, payload.pushTitle, payload.pushBody);
  }
  // Echtzeit-Ping an den Empfänger (Web-SSE). Deckt alle enqueueten Notifications ab
  // (Proposals, Moderation, Stornierungen sowie die neu ergänzten Buchungsanfragen
  // und Ratings).
  publishInboxChanged(payload.userId);
  await outboxRepository.recordDelivery(idempotencyKey);
}

export async function processOutboxEvent(row: OutboxRow) {
  switch (row.eventType) {
    case USER_NOTIFICATION_REQUESTED: {
      const payload = row.payload as UserNotificationPayload;
      if (!payload?.userId || !payload.inAppMessage) {
        throw new Error("Invalid user.notification.requested payload");
      }
      await handleUserNotification(payload, row.idempotencyKey);
      return;
    }
    default:
      throw new Error(`Unknown outbox event type: ${row.eventType}`);
  }
}
