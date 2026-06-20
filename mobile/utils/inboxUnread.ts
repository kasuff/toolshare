import type { Booking, Notification } from '@toolshare/shared';
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
  readIds: Set<string>
): boolean {
  if (booking.type === 'SYSTEM_WARNING') {
    return !booking.isNotificationRead;
  }
  return bookingHasUnreadForUser(booking, currentUserId, readIds);
}

export async function countUnreadInboxItems(
  bookings: Booking[],
  notifications: Notification[],
  currentUserId: string
): Promise<number> {
  await seedReadMessagesIfNeeded(currentUserId, bookings);
  const readIds = await loadReadMessageIds(currentUserId);
  let count = countUnreadInboxThreads(bookings, currentUserId, readIds);

  for (const notification of notifications) {
    if (!notification.read && isInboxSystemNotification(notification.message)) {
      count += 1;
    }
  }

  return count;
}
