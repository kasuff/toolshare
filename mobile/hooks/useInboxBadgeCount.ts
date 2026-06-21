import { useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import { api } from '@toolshare/shared';
import { useAuth } from './useAuth';
import { countUnreadInboxItems } from '../utils/inboxUnread';
import { subscribeInboxBadgeRefresh } from '../utils/inboxBadgeEvents';

const POLL_INTERVAL_MS = 60_000;

export function useInboxBadgeCount(): number {
  const { token, currentUser } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!token || !currentUser?.id) {
      setCount(0);
      return;
    }

    try {
      const [bookings, notifications] = await Promise.all([
        api.getBookingsForUser(token),
        api.getNotifications(token),
      ]);
      setCount(await countUnreadInboxItems(bookings, notifications, currentUser.id));
    } catch {
      setCount(0);
    }
  }, [token, currentUser?.id]);

  useEffect(() => {
    void refresh();

    const intervalId = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    const unsubscribe = subscribeInboxBadgeRefresh(() => void refresh());

    return () => {
      clearInterval(intervalId);
      appStateSubscription.remove();
      unsubscribe();
    };
  }, [refresh]);

  return count;
}
