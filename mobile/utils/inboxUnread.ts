import type { Booking, Notification, Rating } from '@toolshare/shared';
import {
  bookingHasUnreadForUser,
  countUnreadInboxThreads,
  loadReadMessageIds,
  seedReadMessagesIfNeeded,
} from './inboxMessageRead';

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

export async function countUnreadInboxItems(
  bookings: Booking[],
  notifications: Notification[],
  currentUserId: string,
  ratingsReceived: Rating[] = []
): Promise<number> {
  await seedReadMessagesIfNeeded(currentUserId, bookings, ratingsReceived);
  const readIds = await loadReadMessageIds(currentUserId);
  const ratingsByBookingId = new Map(
    ratingsReceived.map((r) => [r.bookingId, r])
  );
  let count = countUnreadInboxThreads(bookings, currentUserId, readIds, ratingsByBookingId);

  for (const notification of notifications) {
    if (!notification.read && isInboxSystemNotification(notification.message)) {
      count += 1;
    }
  }

  return count;
}

