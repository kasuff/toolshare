import type { Booking, PickupProposal, TimeslotProposal } from '@toolshare/shared';
import { storage } from './appStorage';

const STORAGE_VER = 'v1';

function sanitizeStoragePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function inboxReadStorageKey(userId: string): string {
  return `toolshare.inbox.readMsgs.${STORAGE_VER}.${sanitizeStoragePart(userId)}`;
}

export function inboxReadSeedKey(userId: string): string {
  return `toolshare.inbox.readSeed.${STORAGE_VER}.${sanitizeStoragePart(userId)}`;
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
  for (const booking of bookings) {
    keys.push(requestMessageKey(booking.id));
    for (const proposal of booking.pickupProposals ?? []) {
      keys.push(proposalMessageKey(booking.id, proposal.id));
    }
    for (const proposal of booking.timeslotProposals ?? []) {
      keys.push(proposalMessageKey(booking.id, proposal.id));
    }
  }
  return keys;
}

export async function loadReadMessageIds(userId: string): Promise<Set<string>> {
  try {
    const raw = await storage.getItem(inboxReadStorageKey(userId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

export async function saveReadMessageIds(userId: string, ids: Set<string>): Promise<void> {
  try {
    await storage.setItem(inboxReadStorageKey(userId), JSON.stringify([...ids]));
  } catch {
    // Ignore persistence errors.
  }
}

export function countUnreadInboxThreads(
  bookings: Booking[],
  userId: string,
  readIds: Set<string>
): number {
  let count = 0;
  for (const booking of bookings) {
    if (bookingHasUnreadForUser(booking, userId, readIds)) {
      count += 1;
    }
  }
  return count;
}

export function bookingHasUnreadForUser(
  booking: Booking & { pickupProposals?: PickupProposal[]; timeslotProposals?: TimeslotProposal[] },
  userId: string,
  readIds: Set<string>
): boolean {
  if (booking.requesterId !== userId && !readIds.has(requestMessageKey(booking.id))) {
    return true;
  }
  for (const proposal of booking.pickupProposals ?? []) {
    if (proposal.status !== 'PENDING') continue;
    if (proposal.proposedById !== userId && !readIds.has(proposalMessageKey(booking.id, proposal.id))) {
      return true;
    }
  }
  for (const proposal of booking.timeslotProposals ?? []) {
    if (proposal.status !== 'PENDING') continue;
    if (proposal.proposedById !== userId && !readIds.has(proposalMessageKey(booking.id, proposal.id))) {
      return true;
    }
  }
  return false;
}

export function collectIncomingMessageKeys(booking: Booking, currentUserId: string): string[] {
  const keys: string[] = [];
  if (booking.type === 'SYSTEM_WARNING') {
    return keys;
  }
  if (booking.requesterId !== currentUserId) {
    keys.push(requestMessageKey(booking.id));
  }
  for (const proposal of booking.pickupProposals ?? []) {
    if (proposal.status === 'PENDING' && proposal.proposedById !== currentUserId) {
      keys.push(proposalMessageKey(booking.id, proposal.id));
    }
  }
  for (const proposal of booking.timeslotProposals ?? []) {
    if (proposal.status === 'PENDING' && proposal.proposedById !== currentUserId) {
      keys.push(proposalMessageKey(booking.id, proposal.id));
    }
  }
  return keys;
}

export async function seedReadMessagesIfNeeded(
  userId: string,
  bookings: Booking[]
): Promise<Set<string> | null> {
  try {
    const seeded = await storage.getItem(inboxReadSeedKey(userId));
    if (seeded) return null;

    const keys = collectAllMessageKeys(bookings);
    const merged = new Set(await loadReadMessageIds(userId));
    for (const key of keys) {
      merged.add(key);
    }
    await saveReadMessageIds(userId, merged);
    await storage.setItem(inboxReadSeedKey(userId), '1');
    return merged;
  } catch {
    return null;
  }
}

export async function markThreadReadForUser(userId: string, booking: Booking): Promise<Set<string> | null> {
  const currentReadIds = await loadReadMessageIds(userId);
  const incomingKeys = collectIncomingMessageKeys(booking, userId);
  if (incomingKeys.length === 0) {
    return null;
  }

  let changed = false;
  const next = new Set(currentReadIds);
  for (const key of incomingKeys) {
    if (!next.has(key)) {
      next.add(key);
      changed = true;
    }
  }
  if (!changed) {
    return null;
  }

  await saveReadMessageIds(userId, next);
  return next;
}
