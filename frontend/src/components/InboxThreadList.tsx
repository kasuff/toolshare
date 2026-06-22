import React from "react";
import { UserAvatar } from "./UserAvatar";
import {
  BookingRow,
  counterparty,
  getThreadPreview,
  getLastActivityMs,
  formatShortClockOrDate,
  bookingTypeLabel,
} from "../utils/inboxHelpers";
import { Rating } from "@toolshare/shared";

interface InboxThreadListProps {
  sortedRows: BookingRow[];
  selectedBookingId: string | null;
  currentUser: { id: string };
  ratingsByBookingId: Map<string, Rating>;
  readMessageIds: Set<string>;
  threadHasUnread: (booking: BookingRow, currentUserId: string, readIds: Set<string>, rating?: Rating | null) => boolean;
  onSelectThread: (booking: BookingRow) => void;
  threadButtonRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>;
}

export function InboxThreadList({
  sortedRows,
  selectedBookingId,
  currentUser,
  ratingsByBookingId,
  readMessageIds,
  threadHasUnread,
  onSelectThread,
  threadButtonRefs,
}: InboxThreadListProps) {
  return (
    <aside className="messenger-thread-list" aria-label="Konversationen">
      {sortedRows.map((booking) => {
        const active = selectedBookingId === booking.id;
        const cp = counterparty(booking, currentUser.id);
        const preview = getThreadPreview(booking, currentUser.id, ratingsByBookingId.get(booking.id));
        const lastAt = getLastActivityMs(booking, ratingsByBookingId.get(booking.id));
        const threadUnread = threadHasUnread(
          booking,
          currentUser.id,
          readMessageIds,
          ratingsByBookingId.get(booking.id)
        );
        return (
          <button
            ref={(element) => {
              if (element) {
                threadButtonRefs.current.set(booking.id, element);
              } else {
                threadButtonRefs.current.delete(booking.id);
              }
            }}
            key={booking.id}
            type="button"
            className={`messenger-thread-item ${active ? "active" : ""}${threadUnread ? " messenger-thread-item--unread" : ""}`}
            aria-current={active ? "true" : undefined}
            onClick={() => onSelectThread(booking)}
          >
            <span className="messenger-thread-avatar-wrap">
              <UserAvatar name={cp.name} imageUrl={null} size="md" />
              {threadUnread && (
                <span className="messenger-thread-unread-badge" aria-label="1 neue Nachricht">
                  1
                </span>
              )}
            </span>
            <span className="messenger-thread-body">
              <span className="messenger-thread-top">
                <span className="messenger-thread-sub">{cp.name}</span>
                <time className="messenger-thread-time" dateTime={new Date(lastAt).toISOString()}>
                  {formatShortClockOrDate(lastAt)}
                </time>
              </span>
              <strong className="messenger-thread-name">
                {booking.toolName ?? bookingTypeLabel[booking.type]}
              </strong>
              <span className="messenger-thread-preview">{preview}</span>
            </span>
          </button>
        );
      })}
    </aside>
  );
}
