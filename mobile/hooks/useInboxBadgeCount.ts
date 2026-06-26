import { useEffect, useMemo } from 'react';
import type { Rating } from '@toolshare/shared';
import { useAuth } from './useAuth';
import { useInboxData } from './queries/inbox.queries';
import { useInboxReadStore } from '../store/inboxReadStore';
import { isInboxSystemNotification } from '../utils/inboxUnread';
import { countUnreadInboxThreads } from '../utils/inboxMessageRead';

// Tab-Badge mit der Anzahl ungelesener Inbox-Items. Früher ein eigenes
// setInterval-/AppState-Polling – jetzt rein abgeleitet aus dem gemeinsamen
// useInboxData-Query (Polling + Focus-Refetch) und den gelesen-IDs im
// inboxReadStore. Pendant zu useInboxBackground in der Webapp.
export function useInboxBadgeCount(): number {
  const { token, currentUser } = useAuth();
  const { data } = useInboxData(token, currentUser?.id);
  const readMessageIds = useInboxReadStore((s) => s.readMessageIds);
  const loadForUser = useInboxReadStore((s) => s.loadForUser);

  // Sobald die Serverdaten vorliegen, gelesen-IDs (einmalig) seeden/laden.
  useEffect(() => {
    if (data && currentUser?.id) {
      void loadForUser(currentUser.id, data.bookings, data.ratingsReceived);
    }
  }, [data, currentUser?.id, loadForUser]);

  return useMemo(() => {
    if (!data || !currentUser?.id) return 0;
    const ratingsByBookingId = new Map<string, Rating>(
      data.ratingsReceived.map((rating) => [rating.bookingId, rating])
    );
    let count = countUnreadInboxThreads(data.bookings, currentUser.id, readMessageIds, ratingsByBookingId);
    for (const notification of data.notifications) {
      if (!notification.read && isInboxSystemNotification(notification.message)) {
        count += 1;
      }
    }
    return count;
  }, [data, currentUser?.id, readMessageIds]);
}
