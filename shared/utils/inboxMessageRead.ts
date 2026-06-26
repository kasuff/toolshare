import type { Booking, PickupProposal, TimeslotProposal } from "../types/domain";

const STORAGE_VER = "v1";

/** Same-tab updates when inbox read state changes (localStorage alone does not trigger storage event). */
export const INBOX_READ_CHANGED_EVENT = "toolshare-inbox-read-update";

/**
 * Reservierter Read-Receipt-Key, der markiert, dass die Erst-Historie eines Nutzers
 * bereits geseedet wurde. Liegt server-seitig (kein echter Nachrichten-Key), damit
 * das Seeding einmalig pro Nutzer und nicht pro Gerät passiert.
 */
export const INBOX_SEED_MARKER = "__seeded__";

export function inboxReadStorageKey(userId: string): string {
  return `toolshare.inbox.readMsgs.${STORAGE_VER}.${userId}`;
}

export function inboxReadSeedKey(userId: string): string {
  return `toolshare.inbox.readSeed.${STORAGE_VER}.${userId}`;
}

export function requestMessageKey(bookingId: string): string {
  return `req:${bookingId}`;
}

export function proposalMessageKey(bookingId: string, proposalId: string): string {
  return `prop:${bookingId}:${proposalId}`;
}

export function ratingMessageKey(bookingId: string, ratingId: string): string {
  return `rating:${bookingId}:${ratingId}`;
}

export type InboxRatingRef = {
  id: string;
  bookingId: string;
  toUserId: string;
  status?: "SICHTBAR" | "AUSGEBLENDET";
};

export function collectAllMessageKeys(
  bookings: Array<Booking & { pickupProposals?: PickupProposal[]; timeslotProposals?: TimeslotProposal[] }>
): string[] {
  const keys: string[] = [];
  for (const b of bookings) {
    keys.push(requestMessageKey(b.id));
    for (const p of b.pickupProposals ?? []) {
      keys.push(proposalMessageKey(b.id, p.id));
    }
    for (const p of b.timeslotProposals ?? []) {
      keys.push(proposalMessageKey(b.id, p.id));
    }
  }
  return keys;
}

export function collectIncomingMessageKeys(booking: Booking, currentUserId: string): string[] {
  const keys: string[] = [];
  if (booking.type === "SYSTEM_WARNING") {
    return keys;
  }
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
  return keys;
}

/**
 * Gleiche Logik wie die Konversationsliste: ungelesene eingehende Ausleihanfrage-Bubble
 * oder ein noch offener (PENDING) eingehender Alternativvorschlag.
 */
export function bookingHasUnreadForUser(
  booking: Booking & { pickupProposals?: PickupProposal[]; timeslotProposals?: TimeslotProposal[] },
  userId: string,
  readIds: Set<string>,
  rating?: InboxRatingRef | null
): boolean {
  if (booking.requesterId !== userId && !readIds.has(requestMessageKey(booking.id))) {
    return true;
  }
  for (const p of booking.pickupProposals ?? []) {
    if (p.status !== "PENDING") continue;
    if (p.proposedById !== userId && !readIds.has(proposalMessageKey(booking.id, p.id))) {
      return true;
    }
  }
  for (const p of booking.timeslotProposals ?? []) {
    if (p.status !== "PENDING") continue;
    if (p.proposedById !== userId && !readIds.has(proposalMessageKey(booking.id, p.id))) {
      return true;
    }
  }
  if (
    rating &&
    rating.bookingId === booking.id &&
    rating.toUserId === userId &&
    rating.status !== "AUSGEBLENDET" &&
    !readIds.has(ratingMessageKey(booking.id, rating.id))
  ) {
    return true;
  }
  return false;
}

/** Badge / Glocke: Anzahl Konversationen mit mindestens einem Ungelesenen. */
export function countUnreadInboxThreads(
  bookings: Booking[],
  userId: string,
  readIds: Set<string>,
  ratingsByBookingId?: Map<string, InboxRatingRef>
): number {
  let n = 0;
  for (const b of bookings) {
    if (bookingHasUnreadForUser(b, userId, readIds, ratingsByBookingId?.get(b.id))) {
      n += 1;
    }
  }
  return n;
}
