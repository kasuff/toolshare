import { AppError } from "../../utils/app-error";
import { suspensionRepository } from "../users/suspension.repository";
import { notificationsRepository } from "./notifications.repository";
import { pushService } from "./push.service";

export const notificationsService = {
  listForUser(userId: string) {
    return notificationsRepository.listByUser(userId);
  },

  async createWarning(userId: string, reason: string, moderatorName = "Moderator") {
    const safeReason = reason.trim();
    const message = `ERMAHNUNG: ${safeReason}\nModerator: ${moderatorName}\nHinweis: Bei weiteren Verstößen kann dein Konto gesperrt werden.`;
    const notification = await notificationsRepository.create(userId, message);
    await pushService.sendPushNotification(userId, "System-Ermahnung", "Du hast eine neue Ermahnung erhalten.");
    return notification;
  },

  async notifyManagersSuspensionRequest(requestId: string, userName: string, reason: string) {
    const managers = await suspensionRepository.listManagerIds();
    const message = `SPERRUNG_ANFRAGE: Für "${userName}" wurde eine Kontosperrung angefragt.\nGrund: ${reason.trim()}\nAnfrage-ID: ${requestId}`;
    await Promise.all(managers.map((manager) => notificationsRepository.create(manager.id, message)));
  },

  async createSuspensionNotice(userId: string, reason: string) {
    const safeReason = reason.trim();
    const message = `SPERRUNG: Dein Konto wurde gesperrt.\nGrund: ${safeReason}`;
    const notification = await notificationsRepository.create(userId, message);
    await pushService.sendPushNotification(userId, "Konto gesperrt", "Dein Konto wurde von der Administration gesperrt.");
    return notification;
  },

  async markAsRead(userId: string, notificationId: string) {
    const result = await notificationsRepository.markAsRead(notificationId, userId);
    if (result.count === 0) {
      throw new AppError("NOTIFICATION_NOT_FOUND", "Notification not found", 404);
    }
  }
};
