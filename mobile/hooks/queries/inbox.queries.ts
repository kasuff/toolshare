import { useQuery } from '@tanstack/react-query';
import { api } from '@toolshare/shared';
import type { Booking, Notification, Rating } from '@toolshare/shared';

// Pendant zu frontend/src/hooks/queries/inbox.queries.ts.
export const inboxKeys = {
  all: ['inbox'] as const,
  data: (userId: string) => [...inboxKeys.all, userId] as const,
};

export type InboxData = {
  bookings: Booking[];
  ratingsGiven: Rating[];
  ratingsReceived: Rating[];
  notifications: Notification[];
};

// Lädt alle Inbox-Serverdaten in einem Query. Die vier Endpunkte werden immer
// gemeinsam konsumiert (Inbox-Seite + Tab-Badge), daher ein gebündelter Query mit
// einem Cache-Eintrag. Der Hintergrund-Refetch (refetchInterval) und der
// Focus-Refetch (AppState -> focusManager) ersetzen das frühere manuelle
// setInterval/AppState in der Inbox-Seite und in useInboxBadgeCount.
export function useInboxData(token: string | null, userId: string | undefined) {
  return useQuery({
    queryKey: inboxKeys.data(userId ?? ''),
    enabled: Boolean(token && userId),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<InboxData> => {
      const [bookings, ratingsGiven, ratingsReceived, notifications] = await Promise.all([
        api.getBookingsForUser(token!),
        api.getRatingsGiven(token!).catch(() => [] as Rating[]),
        api.getRatingsReceived(token!).catch(() => [] as Rating[]),
        api.getNotifications(token!),
      ]);
      return { bookings, ratingsGiven, ratingsReceived, notifications };
    },
  });
}
