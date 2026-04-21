import { AppError } from "../../utils/app-error";
import { notificationsRepository } from "./notifications.repository";

export const notificationsService = {
  listForUser(userId: string) {
    return notificationsRepository.listByUser(userId);
  },

  async markAsRead(userId: string, notificationId: string) {
    const result = await notificationsRepository.markAsRead(notificationId, userId);
    if (result.count === 0) {
      throw new AppError("NOTIFICATION_NOT_FOUND", "Notification not found", 404);
    }
  }
};
