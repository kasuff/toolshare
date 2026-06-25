import { useQuery } from "@tanstack/react-query";
import { api } from "@toolshare/shared";
import type { Booking, Notification, Rating } from "@toolshare/shared";

export const inboxKeys = {
  all: ["inbox"] as const,
  data: (userId: string) => [...inboxKeys.all, userId] as const
};

export type InboxData = {
  bookings: Booking[];
  ratingsGiven: Rating[];
  ratingsReceived: Rating[];
  notifications: Notification[];
};

// System-Benachrichtigungen, die in der Glocke als ungelesen zählen (Ermahnung,
// Sperrung, Stornierung, Löschung). Früher dreifach im Inbox-Store dupliziert.
export function isAttentionNotification(message: string): boolean {
  return (
    message.startsWith("ERMAHNUNG:") ||
    message.startsWith("SPERRUNG:") ||
    message.includes("wurde storniert") ||
    message.includes("wurde gelöscht")
  );
}

// Lädt alle Inbox-Serverdaten in einem Query. Die vier Endpunkte werden immer
// gemeinsam konsumiert (Inbox-Seite + Glocke), daher ein gebündelter Query mit
// einem Cache-Eintrag. Hintergrund-Refetch (Polling) und Focus-Refetch ersetzen
// das frühere manuelle setInterval/visibilitychange im Layout.
export function useInboxData(token: string | null, userId: string | undefined) {
  return useQuery({
    queryKey: inboxKeys.data(userId ?? ""),
    enabled: Boolean(token && userId),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<InboxData> => {
      const [bookings, ratingsGiven, ratingsReceived, notifications] = await Promise.all([
        api.getBookingsForUser(token!),
        api.getRatingsGiven(token!),
        api.getRatingsReceived(token!),
        api.getNotifications(token!)
      ]);
      return { bookings, ratingsGiven, ratingsReceived, notifications };
    }
  });
}
