import {
  INBOX_READ_CHANGED_EVENT,
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
} from "@toolshare/shared";

export {
  INBOX_READ_CHANGED_EVENT,
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
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(INBOX_READ_CHANGED_EVENT, { detail: { userId } }));
  }
}
