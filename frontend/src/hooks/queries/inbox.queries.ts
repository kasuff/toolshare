import { useQuery } from "@tanstack/react-query";
import { api } from "@toolshare/shared";
import type { Booking, Notification, Rating } from "@toolshare/shared";

export const inboxKeys = {
  all: ["inbox"] as const,
  data: (userId: string) => [...inboxKeys.all, userId] as const,
  readReceipts: (userId: string) => [...inboxKeys.all, "readReceipts", userId] as const
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
// einem Cache-Eintrag. Echtzeit kommt über SSE (useInboxStream → invalidate); das
// Polling-Intervall ist nur noch Sicherheitsnetz (60s statt 20s).
export function useInboxData(token: string | null, userId: string | undefined) {
  return useQuery({
    queryKey: inboxKeys.data(userId ?? ""),
    enabled: Boolean(token && userId),
    refetchInterval: 60_000,
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

// Server-seitiger Read-Status (ersetzt das frühere localStorage). Append-only:
// Keys werden nur hinzugefügt, nie entfernt. Wird in den Inbox-Store gespiegelt
// (useInboxBackground), der die optimistischen Mark-Aktionen hält.
export function useInboxReadReceipts(token: string | null, userId: string | undefined) {
  return useQuery({
    queryKey: inboxKeys.readReceipts(userId ?? ""),
    enabled: Boolean(token && userId),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Set<string>> => {
      const keys = await api.getInboxReadReceipts(token!);
      return new Set(keys);
    }
  });
}
