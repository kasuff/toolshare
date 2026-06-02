import { AppError } from "../../utils/app-error";
import { suspensionRepository } from "../users/suspension.repository";
import { notificationsRepository } from "./notifications.repository";

export const notificationsService = {
  listForUser(userId: string) {
    return notificationsRepository.listByUser(userId);
  },

  async createWarning(userId: string, reason: string) {
    const safeReason = reason.trim();
    const message = `ERMAHNUNG: ${safeReason}\nHinweis: Bei weiteren Verstoessen kann dein Konto gesperrt werden.`;
    return notificationsRepository.create(userId, message);
  },

  async notifyManagersSuspensionRequest(requestId: string, userName: string, reason: string) {
    const managers = await suspensionRepository.listManagerIds();
    const message = `SPERRUNG_ANFRAGE: Fuer "${userName}" wurde eine Kontosperrung angefragt.\nGrund: ${reason.trim()}\nAnfrage-ID: ${requestId}`;
    await Promise.all(managers.map((manager) => notificationsRepository.create(manager.id, message)));
  },

  async createSuspensionNotice(userId: string, reason: string) {
    const safeReason = reason.trim();
    const message = `SPERRUNG: Dein Konto wurde gesperrt.\nGrund: ${safeReason}`;
    return notificationsRepository.create(userId, message);
  },

  async markAsRead(userId: string, notificationId: string) {
    const result = await notificationsRepository.markAsRead(notificationId, userId);
    if (result.count === 0) {
      throw new AppError("NOTIFICATION_NOT_FOUND", "Notification not found", 404);
    }
  }
};
