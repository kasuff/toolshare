import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Booking, Notification } from '@toolshare/shared';

// See inboxMessageRead.test.ts: appStorage depends on the native runtime, so it
// is mocked with an in-memory store here too.
const memory = new Map<string, string>();
vi.mock('../utils/appStorage', () => ({
  storage: {
    getItem: vi.fn(async (key: string) => (memory.has(key) ? memory.get(key)! : null)),
    setItem: vi.fn(async (key: string, value: string) => {
      memory.set(key, value);
    }),
  },
}));

import {
  isInboxSystemNotification,
  isInboxThreadUnread,
  countUnreadInboxItems,
} from '../utils/inboxUnread';

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

function notification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n1',
    userId: 'provider',
    message: 'Hallo',
    read: false,
    createdIso: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  memory.clear();
  vi.clearAllMocks();
});

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
});

describe('countUnreadInboxItems', () => {
  it('seeds existing threads as read on first load and only counts system notifications', async () => {
    const bookings = [booking({ id: 'b1' }), booking({ id: 'b2' })];
    const notifications = [
      notification({ id: 'n1', message: 'SPERRUNG: gesperrt', read: false }), // counts
      notification({ id: 'n2', message: 'SPERRUNG: alt', read: true }), // already read
      notification({ id: 'n3', message: 'Normale Nachricht', read: false }), // not a system notif
    ];

    // First load seeds b1/b2 as read, so only the unread system notification counts.
    const count = await countUnreadInboxItems(bookings, notifications, 'provider');
    expect(count).toBe(1);
  });

  it('counts a booking that arrives after the initial seed', async () => {
    // First load seeds the existing thread.
    await countUnreadInboxItems([booking({ id: 'b1' })], [], 'provider');

    // A newly arrived booking is not covered by the seed, so it is unread,
    // and a fresh system notification is added on top.
    const count = await countUnreadInboxItems(
      [booking({ id: 'b1' }), booking({ id: 'b2' })],
      [notification({ id: 'n1', message: 'ERMAHNUNG: Bitte', read: false })],
      'provider'
    );
    expect(count).toBe(2); // 1 new unread booking + 1 unread system notification
  });

  it('returns zero when there is nothing unread', async () => {
    const bookings = [booking({ id: 'b1', requesterId: 'provider' })]; // own request
    const count = await countUnreadInboxItems(bookings, [], 'provider');
    expect(count).toBe(0);
  });
});
