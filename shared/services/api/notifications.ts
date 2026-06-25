import { request, requestParsed } from "./client";
import { notificationListResponseSchema } from "../../contracts/response/notifications.schema";

export const notificationsApi = {
  async getNotifications(token: string) {
    const notifications = await requestParsed(notificationListResponseSchema, "/notifications/me", undefined, token);
    return notifications.map((n) => ({ ...n, createdIso: n.createdAt }));
  },

  async markNotificationAsRead(notificationId: string, token: string) {
    await request(`/notifications/${notificationId}/read`, { method: "PATCH" }, token);
  }
};
