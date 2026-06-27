import { Expo, ExpoPushTicket } from "expo-server-sdk";
import { usersRepository } from "../../users/repositories/users.repository";

const expo = new Expo();

function logTicketErrors(userId: string, pushToken: string, tickets: ExpoPushTicket[]) {
  for (const ticket of tickets) {
    if (ticket.status === "error") {
      console.error("Push ticket error", {
        userId,
        pushToken,
        message: ticket.message,
        details: ticket.details
      });

      if (ticket.details?.error === "DeviceNotRegistered") {
        usersRepository
          .updateProfile(userId, { expoPushToken: null })
          .catch((error) => console.error("Failed to clear invalid push token", error));
      }
    }
  }
}

async function logReceiptErrors(userId: string, pushToken: string, ticketIds: string[]) {
  if (ticketIds.length === 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 15_000));

  try {
    const receipts = await expo.getPushNotificationReceiptsAsync(ticketIds);

    for (const [receiptId, receipt] of Object.entries(receipts)) {
      if (receipt.status === "error") {
        console.error("Push receipt error", {
          userId,
          pushToken,
          receiptId,
          message: receipt.message,
          details: receipt.details
        });

        if (receipt.details?.error === "DeviceNotRegistered") {
          await usersRepository.updateProfile(userId, { expoPushToken: null });
        }
      }
    }
  } catch (error) {
    console.error("Failed to fetch push notification receipts", error);
  }
}

export const pushService = {
  async sendPushNotification(userId: string, title: string, body: string, data?: Record<string, unknown>) {
    try {
      const user = await usersRepository.findByIdPublic(userId);
      if (!user || !user.expoPushToken) {
        return;
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
          channelId: "default"
        }
      ];

      const chunks = expo.chunkPushNotifications(messages);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error("Error sending push notification chunk", error);
        }
      }

      logTicketErrors(userId, pushToken, tickets);

      const ticketIds = tickets
        .filter((ticket): ticket is ExpoPushTicket & { status: "ok" } => ticket.status === "ok")
        .map((ticket) => ticket.id);

      void logReceiptErrors(userId, pushToken, ticketIds);
    } catch (error) {
      console.error("Failed to send push notification", error);
    }
  }
};