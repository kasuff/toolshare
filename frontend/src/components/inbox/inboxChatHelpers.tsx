import type { ReactNode } from "react";
import type { BookingStatus, Booking, BookingType, PickupProposal, TimeslotProposal, Rating } from "@toolshare/shared";
import { bookingTypeLabel } from "../../utils/inboxHelpers";
import { counterparty } from "../../utils/inboxHelpers";
import { bookingHasUnreadForUser, proposalMessageKey, ratingMessageKey, requestMessageKey } from "../../utils/inboxMessageRead";
import type { BookingRow } from "../../utils/inboxHelpers";

export const bookingStatusLabel: Record<BookingStatus, string> = {
  OFFEN: "Offen",
  BESTAETIGT: "Bestätigt",
  ABGELEHNT: "Abgelehnt",
  ABGESCHLOSSEN: "Abgeschlossen",
};

export function MessengerRow({
  variant,
  avatar,
  children,
}: {
  variant: "incoming" | "outgoing";
  avatar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`messenger-msg-row ${variant}`}>
      {variant === "incoming" && avatar && <div className="messenger-msg-avatar-col">{avatar}</div>}
      <div className="messenger-msg-bubble-col">{children}</div>
      {variant === "outgoing" && avatar && <div className="messenger-msg-avatar-col">{avatar}</div>}
    </div>
  );
}

export function RequestMessageCard({
  label,
  title,
  icon,
  firstLabel,
  firstValue,
  secondLabel,
  secondValue,
  unread = false,
  onClick,
  children
}: {
  label: string;
  title: string;
  icon: string;
  firstLabel?: string;
  firstValue?: string;
  secondLabel?: string;
  secondValue?: string;
  unread?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}) {
  return (
    <article className={`request-message-card${unread ? " request-message-card--unread" : ""}`}>
      <div className="request-message-card-head">
        <span className="request-message-card-icon" aria-hidden="true">
          <span className="material-symbols-outlined">{icon}</span>
        </span>
        <div className="request-message-card-heading">
          <span>{label}</span>
          <h3>{title}</h3>
        </div>
        {onClick && (
          <button type="button" className="icon-button request-message-read-button" onClick={onClick} aria-label="Nachricht als gelesen markieren">
            <span className="material-symbols-outlined" aria-hidden="true">done</span>
          </button>
        )}
      </div>
      {firstLabel && firstValue && secondLabel && secondValue && (
        <div className="request-message-card-metadata">
          <div>
            <span>{firstLabel}</span>
            <strong>{firstValue}</strong>
          </div>
          <div>
            <span>{secondLabel}</span>
            <strong>{secondValue}</strong>
          </div>
        </div>
      )}
      {children}
    </article>
  );
}

export function proposalStatusLabel(status: PickupProposal["status"] | TimeslotProposal["status"]): string {
  if (status === "ACCEPTED") return "Angenommen";
  if (status === "DECLINED") return "Abgelehnt";
  return "Warte auf Antwort";
}

export function threadHasUnread(
  booking: BookingRow,
  currentUserId: string,
  readIds: Set<string>,
  rating?: Rating | null
): boolean {
  if (booking.type === "SYSTEM_WARNING") {
    return !booking.isNotificationRead;
  }
  return bookingHasUnreadForUser(booking, currentUserId, readIds, rating);
}

export function collectIncomingMessageKeys(booking: BookingRow, currentUserId: string, rating?: Rating | null): string[] {
  const keys: string[] = [];
  if (booking.type === "SYSTEM_WARNING") {
    return keys;
  }
  if (booking.requesterId !== currentUserId) {
    keys.push(requestMessageKey(booking.id));
  }
  for (const proposal of booking.pickupProposals) {
    if (proposal.status === "PENDING" && proposal.proposedById !== currentUserId) {
      keys.push(proposalMessageKey(booking.id, proposal.id));
    }
  }
  for (const proposal of booking.timeslotProposals) {
    if (proposal.status === "PENDING" && proposal.proposedById !== currentUserId) {
      keys.push(proposalMessageKey(booking.id, proposal.id));
    }
  }
  if (rating && rating.toUserId === currentUserId && rating.status === "SICHTBAR") {
    keys.push(ratingMessageKey(booking.id, rating.id));
  }
  return keys;
}


export function getBookingContextLabel(type: BookingType): string {
  if (type === "WORKSHOP") return "Werkstatt";
  if (type === "TOOL") return "Ausleihe";
  return bookingTypeLabel[type];
}

export function getSystemWarningLabel(text?: string): string {
  if (text?.startsWith("ERMAHNUNG:")) return "Verwarnung";
  if (text?.startsWith("SPERRUNG:")) return "Gesperrt";
  return "Info";
}

export function getChatHeaderTitle(booking: Booking, currentUserId: string, compact: boolean): string {
  if (compact) {
    if (booking.type === "SYSTEM_WARNING") return "Moderation";
    return counterparty(booking, currentUserId).name;
  }
  if (booking.type === "SYSTEM_WARNING") {
    return booking.toolName ?? "System-Meldung";
  }
  return booking.toolName ?? `${bookingTypeLabel[booking.type]}-Anfrage`;
}

export function getChatHeaderSubtitle(booking: Booking, currentUserId: string, compact: boolean): string {
  if (compact) {
    if (booking.type === "SYSTEM_WARNING") {
      return getSystemWarningLabel(booking.systemWarningText);
    }
    return `${getBookingContextLabel(booking.type)} · ${bookingStatusLabel[booking.status]}`;
  }
  return counterparty(booking, currentUserId).name;
}











