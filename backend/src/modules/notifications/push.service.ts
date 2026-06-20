import { Expo } from "expo-server-sdk";
import { usersRepository } from "../users/users.repository";

// Create a new Expo SDK client
// optionally providing an access token if you have enabled push security
const expo = new Expo();

export const pushService = {
  async sendPushNotification(userId: string, title: string, body: string, data?: Record<string, unknown>) {
    try {
      const user = await usersRepository.findByIdPublic(userId);
      if (!user || !user.expoPushToken) {
        return; // No push token for this user
      }

      const pushToken = user.expoPushToken;

      if (!Expo.isExpoPushToken(pushToken)) {
        console.warn(`Push token ${pushToken} is not a valid Expo push token`);
        return;
      }

      const messages = [
        {
          to: pushToken,
          sound: "default" as const,
          title,
          body,
          data,
        },
      ];

      // The Expo push service accepts batches of notifications so
      // that you don't need to send 1000 requests to send 1000 notifications.
      const chunks = expo.chunkPushNotifications(messages);
      const tickets = [];

      // Send the chunks to the Expo push notification service.
      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error("Error sending push notification chunk", error);
        }
      }
    } catch (error) {
      console.error("Failed to send push notification", error);
    }
  },
};
