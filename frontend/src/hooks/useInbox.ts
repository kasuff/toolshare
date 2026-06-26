import { useEffect, useMemo, useRef } from "react";
import { api } from "@toolshare/shared";
import { useInboxStore } from "../store/inboxStore";
import {
  inboxKeys,
  isAttentionNotification,
  useInboxData,
  useInboxReadReceipts,
  type InboxData
} from "./queries/inbox.queries";
import {
  INBOX_SEED_MARKER,
  collectAllMessageKeys,
  countUnreadInboxThreads,
  ratingMessageKey
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
 * - lädt die gelesen-IDs server-seitig und spiegelt sie in den Store,
 * - seedet beim ersten Mal (server-seitiger __seeded__-Marker) alle vorhandenen
 *   Nachrichten als gelesen, damit die Glocke nicht die komplette Historie zählt,
 * - liefert den ungelesen-Zähler für die Glocke.
 */
export function useInboxBackground(token: string | null | undefined, userId: string | undefined) {
  const inbox = useInboxData(token ?? null, userId);
  const receipts = useInboxReadReceipts(token ?? null, userId);
  const readMessageIds = useInboxStore((state) => state.readMessageIds);
  const mergeServerIds = useInboxStore((state) => state.mergeServerIds);
  const clear = useInboxStore((state) => state.clear);
  const seededForUser = useRef<string | null>(null);

  // Logout / Nutzerwechsel: lokales Set leeren.
  useEffect(() => {
    if (!userId) {
      clear();
      seededForUser.current = null;
    }
  }, [userId, clear]);

  // Server-Receipts in den Store spiegeln (append-only Vereinigung).
  const serverReceipts = receipts.data;
  useEffect(() => {
    if (serverReceipts) mergeServerIds(serverReceipts);
  }, [serverReceipts, mergeServerIds]);

  // Erstes Mal: alle bereits vorhandenen Nachrichten als gelesen seeden. Der
  // __seeded__-Marker liegt server-seitig → einmalig pro Nutzer, nicht pro Gerät.
  const data = inbox.data;
  useEffect(() => {
    if (!token || !userId || !data || !serverReceipts) return;
    if (serverReceipts.has(INBOX_SEED_MARKER)) return;
    if (seededForUser.current === userId) return;
    seededForUser.current = userId;

    const keys = collectAllMessageKeys(data.bookings);
    for (const rating of [...data.ratingsGiven, ...data.ratingsReceived]) {
      keys.push(ratingMessageKey(rating.bookingId, rating.id));
    }
    keys.push(INBOX_SEED_MARKER);

    mergeServerIds(new Set(keys));
    void api.addInboxReadReceipts(keys, token).catch((error) => {
      console.error("Failed to seed inbox read receipts", error);
      seededForUser.current = null; // erneuter Versuch beim nächsten Render
    });
  }, [token, userId, data, serverReceipts, mergeServerIds]);

  const unreadCount = useMemo(() => {
    if (!data || !userId) return 0;
    return computeUnreadCount(data, userId, readMessageIds);
  }, [data, userId, readMessageIds]);

  return { unreadCount };
}
