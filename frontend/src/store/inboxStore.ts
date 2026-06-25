import { create } from "zustand";
import type { Booking, PickupProposal, TimeslotProposal } from "@toolshare/shared";
import {
  loadReadMessageIds,
  saveReadMessageIds,
  ratingMessageKey,
  requestMessageKey,
  proposalMessageKey,
  type InboxRatingRef
} from "../utils/inboxMessageRead";

// Client-State der Inbox: ausschließlich die lokal als gelesen markierten
// Nachrichten-IDs (localStorage-gestützt, kein Server-Pendant). Die Serverdaten
// (Buchungen, Benachrichtigungen, Bewertungen) liegen in TanStack Query
// (useInboxData); der ungelesen-Zähler wird daraus abgeleitet (useInboxBackground).
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

interface InboxReadState {
  readMessageIds: Set<string>;
  /** Lädt die gelesen-IDs des Nutzers aus dem localStorage. */
  loadForUser: (userId: string) => void;
  /** Ersetzt das Set direkt (z. B. nach dem initialen Seeding). */
  setReadIds: (ids: Set<string>) => void;
  markMessageRead: (messageKey: string, userId: string) => void;
  markThreadRead: (
    booking: Booking & { pickupProposals?: PickupProposal[]; timeslotProposals?: TimeslotProposal[] },
    userId: string,
    rating?: InboxRatingRef | null
  ) => void;
  clear: () => void;
}

export const useInboxStore = create<InboxReadState>((set, get) => ({
  readMessageIds: new Set(),

  loadForUser: (userId) => {
    set({ readMessageIds: loadReadMessageIds(userId) });
  },

  setReadIds: (ids) => {
    set({ readMessageIds: ids });
  },

  markMessageRead: (messageKey, userId) => {
    const { readMessageIds } = get();
    if (readMessageIds.has(messageKey)) return;
    const next = new Set(readMessageIds);
    next.add(messageKey);
    saveReadMessageIds(userId, next);
    set({ readMessageIds: next });
  },

  markThreadRead: (booking, userId, rating) => {
    const { readMessageIds } = get();
    const incomingKeys = getIncomingMessageKeys(booking, userId, rating);
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
    set({ readMessageIds: next });
  },

  clear: () => {
    set({ readMessageIds: new Set() });
  }
}));
