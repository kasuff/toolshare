import { create } from "zustand";
import { api } from "@toolshare/shared";
import type { Booking, Notification, Rating, PickupProposal, TimeslotProposal } from "@toolshare/shared";
import { useAuthStore } from "./authStore";
import {
  INBOX_READ_CHANGED_EVENT,
  loadReadMessageIds,
  saveReadMessageIds,
  countUnreadInboxThreads,
  inboxReadSeedKey,
  collectAllMessageKeys,
  ratingMessageKey,
  requestMessageKey,
  proposalMessageKey,
  type InboxRatingRef
} from "../utils/inboxMessageRead";

interface InboxState {
  bookings: Booking[];
  notifications: Notification[];
  ratingsGiven: Rating[];
  ratingsReceived: Rating[];
  readMessageIds: Set<string>;
  isLoading: boolean;
  error: string | null;
  unreadCount: number;

  fetchData: (token: string, userId: string) => Promise<void>;
  markNotificationRead: (notificationId: string, token: string) => Promise<void>;
  markMessageRead: (messageKey: string, userId: string) => void;
  markThreadRead: (
    booking: Booking & { pickupProposals?: PickupProposal[]; timeslotProposals?: TimeslotProposal[] },
    userId: string
  ) => void;
  refreshUnreadFromStorage: (userId: string) => void;
  clear: () => void;
}

function recalculateUnreadCount(
  bookings: Booking[],
  userId: string,
  readMessageIds: Set<string>,
  ratingsReceived: Rating[],
  notifications: Notification[]
): number {
  const ratingsByBookingId = new Map(
    ratingsReceived.map((rating) => [
      rating.bookingId,
      { id: rating.id, bookingId: rating.bookingId, toUserId: rating.toUserId, status: rating.status }
    ])
  );

  const count = countUnreadInboxThreads(bookings, userId, readMessageIds, ratingsByBookingId);
  const unreadNotifications = notifications.filter(
    (n) =>
      !n.read &&
      (n.message.startsWith("ERMAHNUNG:") ||
        n.message.startsWith("SPERRUNG:") ||
        n.message.includes("wurde storniert") ||
        n.message.includes("wurde gelöscht"))
  );
  return count + unreadNotifications.length;
}

function getIncomingMessageKeys(
  booking: Booking & { pickupProposals?: PickupProposal[]; timeslotProposals?: TimeslotProposal[] },
  currentUserId: string,
  rating?: InboxRatingRef | null
): string[] {
  const keys: string[] = [];
  if (booking.requesterId !== currentUserId) {
    keys.push(requestMessageKey(booking.id));
  }
  for (const proposal of booking.pickupProposals ?? []) {
    if (proposal.status === "PENDING" && proposal.proposedById !== currentUserId) {
      keys.push(proposalMessageKey(booking.id, proposal.id));
    }
  }
  for (const proposal of booking.timeslotProposals ?? []) {
    if (proposal.status === "PENDING" && proposal.proposedById !== currentUserId) {
      keys.push(proposalMessageKey(booking.id, proposal.id));
    }
  }
  if (rating && rating.toUserId === currentUserId && rating.status === "SICHTBAR") {
    keys.push(ratingMessageKey(booking.id, rating.id));
  }
  return keys;
}

export const useInboxStore = create<InboxState>((set, get) => ({
  bookings: [],
  notifications: [],
  ratingsGiven: [],
  ratingsReceived: [],
  readMessageIds: new Set(),
  isLoading: false,
  error: null,
  unreadCount: 0,

  fetchData: async (token, userId) => {
    set({ isLoading: true });
    try {
      const [nextBookings, nextGivenRatings, nextReceivedRatings, fetchedNotifications] = await Promise.all([
        api.getBookingsForUser(token),
        api.getRatingsGiven(token),
        api.getRatingsReceived(token),
        api.getNotifications(token)
      ]);

      const ratingsByBookingId = new Map(
        nextReceivedRatings.map((rating) => [
          rating.bookingId,
          { id: rating.id, bookingId: rating.bookingId, toUserId: rating.toUserId, status: rating.status }
        ])
      );

      // Seeding logic (initial load of all messages marked as read)
      let readIds = loadReadMessageIds(userId);
      if (!localStorage.getItem(inboxReadSeedKey(userId)) && nextBookings.length > 0) {
        const keys = collectAllMessageKeys(nextBookings);
        for (const rating of [...nextGivenRatings, ...nextReceivedRatings]) {
          keys.push(ratingMessageKey(rating.bookingId, rating.id));
        }
        const merged = new Set(readIds);
        for (const k of keys) merged.add(k);
        saveReadMessageIds(userId, merged);
        localStorage.setItem(inboxReadSeedKey(userId), "1");
        readIds = merged;
      }

      // Calculate unread threads
      let count = countUnreadInboxThreads(nextBookings, userId, readIds, ratingsByBookingId);

      // Add system notifications that require attention (warning/suspension/cancellation)
      const unreadNotifications = fetchedNotifications.filter(
        (n) =>
          !n.read &&
          (n.message.startsWith("ERMAHNUNG:") ||
            n.message.startsWith("SPERRUNG:") ||
            n.message.includes("wurde storniert") ||
            n.message.includes("wurde gelöscht"))
      );
      count += unreadNotifications.length;

      set({
        bookings: nextBookings,
        ratingsGiven: nextGivenRatings,
        ratingsReceived: nextReceivedRatings,
        notifications: fetchedNotifications,
        readMessageIds: readIds,
        unreadCount: count,
        error: null
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Fehler beim Laden der Inbox" });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  markNotificationRead: async (notificationId, token) => {
    try {
      await api.markNotificationAsRead(notificationId, token);
      
      const { notifications, bookings, ratingsReceived, readMessageIds } = get();
      const updatedNotifications = notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      
      const ratingsByBookingId = new Map(
        ratingsReceived.map((rating) => [
          rating.bookingId,
          { id: rating.id, bookingId: rating.bookingId, toUserId: rating.toUserId, status: rating.status }
        ])
      );
      const currentUserId = useAuthStore.getState().currentUser?.id;
      let count = 0;
      if (currentUserId) {
        count = countUnreadInboxThreads(bookings, currentUserId, readMessageIds, ratingsByBookingId);
        const unreadNotifications = updatedNotifications.filter(
          (n) =>
            !n.read &&
            (n.message.startsWith("ERMAHNUNG:") ||
              n.message.startsWith("SPERRUNG:") ||
              n.message.includes("wurde storniert") ||
              n.message.includes("wurde gelöscht"))
        );
        count += unreadNotifications.length;
      }
      
      set({
        notifications: updatedNotifications,
        unreadCount: count
      });
    } catch (err) {
      console.error(err);
      throw err;
    }
  },

  markMessageRead: (messageKey, userId) => {
    const { readMessageIds, bookings, ratingsReceived, notifications } = get();
    if (readMessageIds.has(messageKey)) return;

    const next = new Set(readMessageIds);
    next.add(messageKey);
    saveReadMessageIds(userId, next);

    const ratingsByBookingId = new Map(
      ratingsReceived.map((rating) => [
        rating.bookingId,
        { id: rating.id, bookingId: rating.bookingId, toUserId: rating.toUserId, status: rating.status }
      ])
    );

    let count = countUnreadInboxThreads(bookings, userId, next, ratingsByBookingId);
    const unreadNotifications = notifications.filter(
      (n) =>
        !n.read &&
        (n.message.startsWith("ERMAHNUNG:") ||
          n.message.startsWith("SPERRUNG:") ||
          n.message.includes("wurde storniert") ||
          n.message.includes("wurde gelöscht"))
    );
    count += unreadNotifications.length;

    set({
      readMessageIds: next,
      unreadCount: count
    });
  },

  markThreadRead: (booking, userId) => {
    const { readMessageIds, bookings, ratingsReceived, notifications } = get();
    const ratingsByBookingId = new Map(
      ratingsReceived.map((rating) => [
        rating.bookingId,
        { id: rating.id, bookingId: rating.bookingId, toUserId: rating.toUserId, status: rating.status }
      ])
    );
    
    const incomingKeys = getIncomingMessageKeys(
      booking,
      userId,
      ratingsByBookingId.get(booking.id)
    );
    if (incomingKeys.length === 0) return;

    const next = new Set(readMessageIds);
    let changed = false;
    for (const key of incomingKeys) {
      if (!next.has(key)) {
        next.add(key);
        changed = true;
      }
    }
    if (!changed) return;

    saveReadMessageIds(userId, next);

    let count = countUnreadInboxThreads(bookings, userId, next, ratingsByBookingId);
    const unreadNotifications = notifications.filter(
      (n) =>
        !n.read &&
        (n.message.startsWith("ERMAHNUNG:") ||
          n.message.startsWith("SPERRUNG:") ||
          n.message.includes("wurde storniert") ||
          n.message.includes("wurde gelöscht"))
    );
    count += unreadNotifications.length;

    set({
      readMessageIds: next,
      unreadCount: count
    });
  },

  refreshUnreadFromStorage: (userId) => {
    const { bookings, ratingsReceived, notifications } = get();
    const readMessageIds = loadReadMessageIds(userId);
    const unreadCount = recalculateUnreadCount(bookings, userId, readMessageIds, ratingsReceived, notifications);
    set({ readMessageIds, unreadCount });
  },

  clear: () => {
    set({
      bookings: [],
      notifications: [],
      ratingsGiven: [],
      ratingsReceived: [],
      readMessageIds: new Set(),
      unreadCount: 0,
      error: null
    });
  }
}));

if (typeof window !== "undefined") {
  window.addEventListener(INBOX_READ_CHANGED_EVENT, (event) => {
    const userId =
      (event as CustomEvent<{ userId?: string }>).detail?.userId ??
      useAuthStore.getState().currentUser?.id;
    if (userId) {
      useInboxStore.getState().refreshUnreadFromStorage(userId);
    }
  });
}
