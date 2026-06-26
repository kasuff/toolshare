import { create } from "zustand";
import { api } from "@toolshare/shared";
import type { Booking, PickupProposal, TimeslotProposal } from "@toolshare/shared";
import {
  ratingMessageKey,
  requestMessageKey,
  proposalMessageKey,
  type InboxRatingRef
} from "../utils/inboxMessageRead";
import { useAuthStore } from "./authStore";

// Client-State der Inbox: die als gelesen markierten Nachrichten-IDs. Quelle der
// Wahrheit ist jetzt der Server (useInboxReadReceipts); dieser Store spiegelt die
// Server-Menge (mergeServerIds) und hält die optimistischen Mark-Aktionen. Da der
// Read-Status append-only ist (Keys werden nur hinzugefügt), ist die Vereinigung von
// Server- und lokalem Set immer korrekt und vermeidet Flackern, wenn ein Refetch
// einen gerade optimistisch markierten Key noch nicht enthält.
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

// Persistiert die Keys server-seitig (fire-and-forget; bei Fehler bleibt der lokale
// optimistische Stand, der nächste Refetch korrigiert/bestätigt ihn).
function persist(messageKeys: string[]): void {
  const token = useAuthStore.getState().token;
  if (!token || messageKeys.length === 0) return;
  void api.addInboxReadReceipts(messageKeys, token).catch((error) => {
    console.error("Failed to persist inbox read receipts", error);
  });
}

interface InboxReadState {
  readMessageIds: Set<string>;
  /** Vereinigt die vom Server geladenen IDs mit dem lokalen Set (append-only). */
  mergeServerIds: (ids: Set<string>) => void;
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

  mergeServerIds: (ids) => {
    const { readMessageIds } = get();
    let changed = readMessageIds.size !== ids.size;
    const next = new Set(readMessageIds);
    for (const id of ids) {
      if (!next.has(id)) {
        next.add(id);
        changed = true;
      }
    }
    if (changed) set({ readMessageIds: next });
  },

  markMessageRead: (messageKey) => {
    const { readMessageIds } = get();
    if (readMessageIds.has(messageKey)) return;
    const next = new Set(readMessageIds);
    next.add(messageKey);
    set({ readMessageIds: next });
    persist([messageKey]);
  },

  markThreadRead: (booking, userId, rating) => {
    const { readMessageIds } = get();
    const incomingKeys = getIncomingMessageKeys(booking, userId, rating);
    if (incomingKeys.length === 0) return;

    const next = new Set(readMessageIds);
    const added: string[] = [];
    for (const key of incomingKeys) {
      if (!next.has(key)) {
        next.add(key);
        added.push(key);
      }
    }
    if (added.length === 0) return;

    set({ readMessageIds: next });
    persist(added);
  },

  clear: () => {
    set({ readMessageIds: new Set() });
  }
}));
