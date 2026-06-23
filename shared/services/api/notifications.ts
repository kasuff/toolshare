import { request } from "./client";

export const notificationsApi = {
  async getNotifications(token: string) {
    const notifications = await request<Array<{ id: string; userId: string; message: string; read: boolean; createdAt: string }>>(
      "/notifications/me",
      undefined,
      token
    );
    return notifications.map((n) => ({ ...n, createdIso: n.createdAt }));
  },

  async markNotificationAsRead(notificationId: string, token: string) {
    await request(`/notifications/${notificationId}/read`, { method: "PATCH" }, token);
  },

};
