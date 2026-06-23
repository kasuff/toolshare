import { useCallback, useEffect, useState } from 'react';
import type { Booking, Rating } from '@toolshare/shared';
import { useAuth } from './useAuth';
import {
  loadReadMessageIds,
  markThreadReadForUser,
  seedReadMessagesIfNeeded,
} from '../utils/inboxMessageRead';
import { notifyInboxBadgeRefresh } from '../utils/inboxBadgeEvents';

export function useInboxReadMessages(
  bookings: Booking[],
  ratings: Rating[],
  isLoading: boolean = false
) {
  const { currentUser } = useAuth();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) {
      setReadIds(new Set());
      setIsStorageLoaded(false);
      return;
    }

    if (isLoading) {
      return;
    }

    let cancelled = false;
    const apiBookings = bookings.filter((booking) => booking.type !== 'SYSTEM_WARNING');

    void (async () => {
      const seededIds = await seedReadMessagesIfNeeded(currentUser.id, apiBookings, ratings);
      const ids = seededIds ?? (await loadReadMessageIds(currentUser.id));
      if (!cancelled) {
        setReadIds(ids);
        setIsStorageLoaded(true);
        if (seededIds) {
          notifyInboxBadgeRefresh();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, bookings, ratings, isLoading]);

  const markThreadRead = useCallback(
    async (booking: Booking, rating?: Rating | null) => {
      if (!currentUser?.id || booking.type === 'SYSTEM_WARNING') return;
      const next = await markThreadReadForUser(currentUser.id, booking, rating);
      if (next) {
        setReadIds(next);
        notifyInboxBadgeRefresh();
      }
    },
    [currentUser?.id]
  );

  return { readIds, markThreadRead, isStorageLoaded };
}

