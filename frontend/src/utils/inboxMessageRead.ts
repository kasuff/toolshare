import type { Booking, PickupProposal, TimeslotProposal } from "../types/domain";

const STORAGE_VER = "v1";

/** Same-tab updates when inbox read state changes (localStorage alone does not trigger storage event). */
export const INBOX_READ_CHANGED_EVENT = "toolshare-inbox-read-update";

export function inboxReadStorageKey(userId: string): string {
  return `toolshare.inbox.readMsgs.${STORAGE_VER}:${userId}`;
}

export function inboxReadSeedKey(userId: string): string {
  return `toolshare.inbox.readSeed.${STORAGE_VER}:${userId}`;
}

export function requestMessageKey(bookingId: string): string {
  return `req:${bookingId}`;
}

export function proposalMessageKey(bookingId: string, proposalId: string): string {
  return `prop:${bookingId}:${proposalId}`;
}

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

export function loadReadMessageIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(inboxReadStorageKey(userId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function saveReadMessageIds(userId: string, ids: Set<string>): void {
  localStorage.setItem(inboxReadStorageKey(userId), JSON.stringify([...ids]));
}

/**
 * Gleiche Logik wie die Konversationsliste: ungelesene eingehende Ausleihanfrage-Bubble
 * oder ein noch offener (PENDING) eingehender Alternativvorschlag.
 * Abgeschlossene Vorschläge (angenommen/abgelehnt) blockieren „Ungelesen“ nicht mehr.
 */
export function bookingHasUnreadForUser(
  booking: Booking & { pickupProposals?: PickupProposal[]; timeslotProposals?: TimeslotProposal[] },
  userId: string,
  readIds: Set<string>
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
  return false;
}

/** Badge / Glocke: Anzahl Konversationen mit mindestens einem Ungelesenen (Anfrage oder Alternativvorschlag). */
export function countUnreadInboxThreads(bookings: Booking[], userId: string, readIds: Set<string>): number {
  let n = 0;
  for (const b of bookings) {
    if (bookingHasUnreadForUser(b, userId, readIds)) {
      n += 1;
    }
  }
  return n;
}
