import { AppError } from "../../utils/app-error";
import {
  enqueueModerationNotification,
  newModerationNotificationKey
} from "../../infrastructure/outbox/enqueue-user-notification";
import { buildNotificationIdempotencyKey } from "../../domain/events/notification.events";
import { suspensionRepository } from "../users/suspension.repository";
import { notificationsRepository } from "./notifications.repository";
import { toNotificationResponseList } from "./notifications.presenter";
import type { PageParams } from "../../utils/pagination";

export const notificationsService = {
  async listForUser(userId: string, page: PageParams) {
    const notifications = await notificationsRepository.listByUser(userId, page);
    return toNotificationResponseList(notifications);
  },

  async createWarning(userId: string, reason: string, moderatorName = "Moderator") {
    const safeReason = reason.trim();
    const message = `ERMAHNUNG: ${safeReason}\nModerator: ${moderatorName}\nHinweis: Bei weiteren Verstößen kann dein Konto gesperrt werden.`;
    await enqueueModerationNotification({
      userId,
      inAppMessage: message,
      pushTitle: "System-Ermahnung",
      pushBody: "Du hast eine neue Ermahnung erhalten.",
      idempotencyKey: newModerationNotificationKey("warning")
    });
  },

  async notifyManagersSuspensionRequest(requestId: string, userName: string, reason: string) {
    const managers = await suspensionRepository.listManagerIds();
    const message = `SPERRUNG_ANFRAGE: Für "${userName}" wurde eine Kontosperrung angefragt.\nGrund: ${reason.trim()}\nAnfrage-ID: ${requestId}`;
    await Promise.all(
      managers.map((manager) =>
        enqueueModerationNotification({
          userId: manager.id,
          inAppMessage: message,
          idempotencyKey: buildNotificationIdempotencyKey(
            "suspension-request",
            requestId,
            manager.id
          ),
          aggregateType: "suspension-request",
          aggregateId: requestId
        })
      )
    );
  },

  async createSuspensionNotice(userId: string, reason: string) {
    const safeReason = reason.trim();
    const message = `SPERRUNG: Dein Konto wurde gesperrt.\nGrund: ${safeReason}`;
    await enqueueModerationNotification({
      userId,
      inAppMessage: message,
      pushTitle: "Konto gesperrt",
      pushBody: "Dein Konto wurde von der Administration gesperrt.",
      idempotencyKey: buildNotificationIdempotencyKey("suspension", userId, safeReason),
      aggregateType: "user",
      aggregateId: userId
    });
  },

  async markAsRead(userId: string, notificationId: string) {
    const result = await notificationsRepository.markAsRead(notificationId, userId);
    if (result.count === 0) {
      throw new AppError("NOTIFICATION_NOT_FOUND", "Notification not found", 404);
    }
  }
};
