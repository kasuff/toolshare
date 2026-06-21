import { useCallback, useEffect, useState } from 'react';
import type { Booking } from '@toolshare/shared';
import { useAuth } from './useAuth';
import {
  loadReadMessageIds,
  markThreadReadForUser,
  seedReadMessagesIfNeeded,
} from '../utils/inboxMessageRead';
import { notifyInboxBadgeRefresh } from '../utils/inboxBadgeEvents';

export function useInboxReadMessages(bookings: Booking[]) {
  const { currentUser } = useAuth();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUser?.id) {
      setReadIds(new Set());
      return;
    }

    let cancelled = false;
    const apiBookings = bookings.filter((booking) => booking.type !== 'SYSTEM_WARNING');

    void (async () => {
      const seededIds = await seedReadMessagesIfNeeded(currentUser.id, apiBookings);
      const ids = seededIds ?? (await loadReadMessageIds(currentUser.id));
      if (!cancelled) {
        setReadIds(ids);
        if (seededIds) {
          notifyInboxBadgeRefresh();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, bookings]);

  const markThreadRead = useCallback(
    async (booking: Booking) => {
      if (!currentUser?.id || booking.type === 'SYSTEM_WARNING') return;
      const next = await markThreadReadForUser(currentUser.id, booking);
      if (next) {
        setReadIds(next);
        notifyInboxBadgeRefresh();
      }
    },
    [currentUser?.id]
  );

  return { readIds, markThreadRead };
}
