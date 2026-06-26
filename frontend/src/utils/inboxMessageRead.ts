import {
  INBOX_SEED_MARKER,
  requestMessageKey,
  proposalMessageKey,
  ratingMessageKey,
  collectAllMessageKeys,
  collectIncomingMessageKeys,
  bookingHasUnreadForUser,
  countUnreadInboxThreads,
  type InboxRatingRef,
} from "@toolshare/shared";

// Der Read-Status liegt server-seitig (siehe store/inboxStore.ts +
// hooks/queries/inbox.queries.ts). Hier werden nur noch die reinen
// Key-/Zähl-Helfer aus shared re-exportiert; die frühere localStorage-Persistenz
// und der Cross-Tab-Event entfallen.
export {
  INBOX_SEED_MARKER,
  requestMessageKey,
  proposalMessageKey,
  ratingMessageKey,
  collectAllMessageKeys,
  collectIncomingMessageKeys,
  bookingHasUnreadForUser,
  countUnreadInboxThreads,
  type InboxRatingRef,
};
