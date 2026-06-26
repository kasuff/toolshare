import { describe, it, expect } from 'vitest';
import type { Booking, Rating } from '@toolshare/shared';

import { isInboxSystemNotification, isInboxThreadUnread } from '../utils/inboxUnread';

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'b1',
    type: 'TOOL',
    requesterId: 'requester',
    providerId: 'provider',
    status: 'OFFEN',
    createdIso: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('isInboxSystemNotification', () => {
  it('matches warning/ban prefixes and cancellation/deletion phrases', () => {
    expect(isInboxSystemNotification('ERMAHNUNG: Bitte beachten')).toBe(true);
    expect(isInboxSystemNotification('SPERRUNG: Konto gesperrt')).toBe(true);
    expect(isInboxSystemNotification('Die Buchung wurde storniert')).toBe(true);
    expect(isInboxSystemNotification('Das Werkzeug wurde gelöscht')).toBe(true);
  });

  it('does not match ordinary messages', () => {
    expect(isInboxSystemNotification('Neue Nachricht erhalten')).toBe(false);
  });
});

describe('isInboxThreadUnread', () => {
  it('uses the notification-read flag for system warnings', () => {
    expect(
      isInboxThreadUnread(
        booking({ type: 'SYSTEM_WARNING', isNotificationRead: false }),
        'requester',
        new Set()
      )
    ).toBe(true);
    expect(
      isInboxThreadUnread(
        booking({ type: 'SYSTEM_WARNING', isNotificationRead: true }),
        'requester',
        new Set()
      )
    ).toBe(false);
  });

  it('delegates to the per-user unread check for normal bookings', () => {
    expect(isInboxThreadUnread(booking(), 'provider', new Set())).toBe(true);
    expect(isInboxThreadUnread(booking(), 'provider', new Set(['req:b1']))).toBe(false);
  });

  it('delegates to the per-user unread check for normal bookings with ratings', () => {
    const r: Rating = { id: 'r1', bookingId: 'b1', fromUserId: 'requester', toUserId: 'provider', score: 5, comment: 'gut', status: 'SICHTBAR', createdIso: '2026-06-01T10:00:00.000Z' };
    expect(isInboxThreadUnread(booking(), 'provider', new Set(), r)).toBe(true);
    expect(isInboxThreadUnread(booking(), 'provider', new Set(['req:b1', 'rating:b1:r1']), r)).toBe(false);
  });
});
