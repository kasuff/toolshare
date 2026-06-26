import { useEffect, useMemo } from "react";
import { useInboxStore } from "../store/inboxStore";
import {
  inboxKeys,
  isAttentionNotification,
  useInboxData,
  type InboxData
} from "./queries/inbox.queries";
import {
  INBOX_READ_CHANGED_EVENT,
  collectAllMessageKeys,
  countUnreadInboxThreads,
  inboxReadSeedKey,
  loadReadMessageIds,
  ratingMessageKey,
  saveReadMessageIds
} from "../utils/inboxMessageRead";

export { inboxKeys };

function ratingRefsByBookingId(data: InboxData) {
  return new Map(
    data.ratingsReceived.map((rating) => [
      rating.bookingId,
      { id: rating.id, bookingId: rating.bookingId, toUserId: rating.toUserId, status: rating.status }
    ])
  );
}

/** Abgeleiteter ungelesen-Zähler aus Query-Daten + lokal gelesenen IDs. */
export function computeUnreadCount(
  data: InboxData,
  userId: string,
  readMessageIds: Set<string>
): number {
  const threadCount = countUnreadInboxThreads(
    data.bookings,
    userId,
    readMessageIds,
    ratingRefsByBookingId(data)
  );
  const unreadNotifications = data.notifications.filter(
    (n) => !n.read && isAttentionNotification(n.message)
  );
  return threadCount + unreadNotifications.length;
}

/**
 * Hintergrund-Logik der Inbox, einmal app-weit im Layout gemountet:
 * - hält den Inbox-Query am Leben (Polling/Focus-Refetch über TanStack Query),
 * - lädt die gelesen-IDs bei Nutzerwechsel,
 * - seedet beim ersten Laden alle vorhandenen Nachrichten als gelesen,
 * - synchronisiert die gelesen-IDs tab-übergreifend,
 * - liefert den ungelesen-Zähler für die Glocke.
 */
export function useInboxBackground(token: string | null | undefined, userId: string | undefined) {
  const inbox = useInboxData(token ?? null, userId);
  const readMessageIds = useInboxStore((state) => state.readMessageIds);
  const loadForUser = useInboxStore((state) => state.loadForUser);
  const setReadIds = useInboxStore((state) => state.setReadIds);
  const clear = useInboxStore((state) => state.clear);

  // gelesen-IDs bei Nutzerwechsel laden / bei Logout leeren
  useEffect(() => {
    if (userId) {
      loadForUser(userId);
    } else {
      clear();
    }
  }, [userId, loadForUser, clear]);

  // Cross-Tab-Sync: anderer Tab markiert etwas → IDs neu aus dem Storage laden
  useEffect(() => {
    if (!userId) return;
    const onChange = () => loadForUser(userId);
    window.addEventListener(INBOX_READ_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(INBOX_READ_CHANGED_EVENT, onChange);
  }, [userId, loadForUser]);

  // Erstes Laden: alle bereits vorhandenen Nachrichten als gelesen seeden,
  // damit die Glocke nicht sofort die komplette Historie als ungelesen zählt.
  const data = inbox.data;
  useEffect(() => {
    if (!userId || !data || data.bookings.length === 0) return;
    if (localStorage.getItem(inboxReadSeedKey(userId))) return;

    const keys = collectAllMessageKeys(data.bookings);
    for (const rating of [...data.ratingsGiven, ...data.ratingsReceived]) {
      keys.push(ratingMessageKey(rating.bookingId, rating.id));
    }
    const merged = new Set(loadReadMessageIds(userId));
    for (const key of keys) merged.add(key);
    saveReadMessageIds(userId, merged);
    localStorage.setItem(inboxReadSeedKey(userId), "1");
    setReadIds(merged);
  }, [userId, data, setReadIds]);

  const unreadCount = useMemo(() => {
    if (!data || !userId) return 0;
    return computeUnreadCount(data, userId, readMessageIds);
  }, [data, userId, readMessageIds]);

  return { unreadCount };
}
