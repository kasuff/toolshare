import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { api } from '@toolshare/shared';
import { useAuth } from './useAuth';
import { countUnreadInboxItems } from '../utils/inboxUnread';
import { subscribeInboxBadgeRefresh } from '../utils/inboxBadgeEvents';

const POLL_INTERVAL_MS = 30_000;
const MIN_FETCH_INTERVAL_MS = 3_000;

export function useInboxBadgeCount(): number {
  const { token, currentUser } = useAuth();
  const [count, setCount] = useState(0);
  const lastFetchAtRef = useRef(0);
  const inFlightRef = useRef(false);

  const fetchFromApi = useCallback(async (force = false) => {
    if (!token || !currentUser?.id || inFlightRef.current) {
      return;
    }

    const now = Date.now();
    if (!force && now - lastFetchAtRef.current < MIN_FETCH_INTERVAL_MS) {
      return;
    }

    inFlightRef.current = true;
    lastFetchAtRef.current = now;

    try {
      const [bookings, notifications] = await Promise.all([
        api.getBookingsForUser(token),
        api.getNotifications(token),
      ]);
      setCount(await countUnreadInboxItems(bookings, notifications, currentUser.id));
    } catch {
      // Keep the previous badge count when a background refresh fails.
    } finally {
      inFlightRef.current = false;
    }
  }, [token, currentUser?.id]);

  const refresh = useCallback(
    (knownCount?: number) => {
      if (!token || !currentUser?.id) {
        setCount(0);
        return;
      }

      if (knownCount !== undefined) {
        setCount(knownCount);
        return;
      }

      void fetchFromApi(true);
    },
    [token, currentUser?.id, fetchFromApi]
  );

  useEffect(() => {
    void fetchFromApi(true);

    const intervalId = setInterval(() => void fetchFromApi(), POLL_INTERVAL_MS);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void fetchFromApi(true);
    });
    const unsubscribe = subscribeInboxBadgeRefresh((knownCount) => refresh(knownCount));

    return () => {
      clearInterval(intervalId);
      appStateSubscription.remove();
      unsubscribe();
    };
  }, [fetchFromApi, refresh]);

  return count;
}
