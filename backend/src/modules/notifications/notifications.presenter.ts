import type { NotificationResponse } from "@toolshare/shared/contracts/response/notifications.schema";
import type { NotificationEntity } from "./notifications.entity";

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : String(value);

export function toNotificationResponse(notification: NotificationEntity): NotificationResponse {
  return {
    id: notification.id,
    userId: notification.userId,
    message: notification.message,
    read: notification.read,
    createdAt: iso(notification.createdAt)
  };
}

export function toNotificationResponseList(
  notifications: NotificationEntity[]
): NotificationResponse[] {
  return notifications.map(toNotificationResponse);
}
