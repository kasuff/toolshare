import {
  INBOX_SEED_MARKER,
  INBOX_READ_CHANGED_EVENT,
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
import { useInboxStore } from "../store/inboxStore";

export {
  INBOX_SEED_MARKER,
  INBOX_READ_CHANGED_EVENT,
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

// Aktualisiert den lokalen Zustand der gelesenen Nachrichten-IDs im Zustand-Store.
// Wird in Tests genutzt, um den Read-Status vor dem Rendern vorzusetzen.
export function saveReadMessageIds(_userId: string, readIds: Set<string>): void {
  useInboxStore.getState().mergeServerIds(readIds);
}
