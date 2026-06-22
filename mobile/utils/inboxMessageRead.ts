import type { Booking } from "@toolshare/shared";
import {
  collectAllMessageKeys,
  collectIncomingMessageKeys,
  inboxReadSeedKey,
  inboxReadStorageKey,
  requestMessageKey,
  proposalMessageKey,
  ratingMessageKey,
  bookingHasUnreadForUser,
  countUnreadInboxThreads,
  type InboxRatingRef,
} from "@toolshare/shared";
import { storage } from "./appStorage";

export {
  inboxReadStorageKey,
  inboxReadSeedKey,
  requestMessageKey,
  proposalMessageKey,
  ratingMessageKey,
  collectAllMessageKeys,
  collectIncomingMessageKeys,
  bookingHasUnreadForUser,
  countUnreadInboxThreads,
  type InboxRatingRef,
};

export async function loadReadMessageIds(userId: string): Promise<Set<string>> {
  try {
    const raw = await storage.getItem(inboxReadStorageKey(userId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
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
    await storage.setItem(inboxReadSeedKey(userId), "1");
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
