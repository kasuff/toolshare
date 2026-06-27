export const USER_NOTIFICATION_REQUESTED = "user.notification.requested" as const;

export type UserNotificationPayload = {
  userId: string;
  inAppMessage: string;
  pushTitle?: string;
  pushBody?: string;
};

export function buildNotificationIdempotencyKey(...parts: string[]) {
  return parts.join(":");
}