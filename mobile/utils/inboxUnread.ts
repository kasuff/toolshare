import type { Booking, Rating } from '@toolshare/shared';
import { bookingHasUnreadForUser } from './inboxMessageRead';

export function isInboxSystemNotification(message: string): boolean {
  return (
    message.startsWith('ERMAHNUNG:') ||
    message.startsWith('SPERRUNG:') ||
    message.includes('wurde storniert') ||
    message.includes('wurde gelöscht')
  );
}

export function isInboxThreadUnread(
  booking: Booking,
  currentUserId: string,
  readIds: Set<string>,
  rating?: Rating | null
): boolean {
  if (booking.type === 'SYSTEM_WARNING') {
    return !booking.isNotificationRead;
  }
  return bookingHasUnreadForUser(booking, currentUserId, readIds, rating);
}

