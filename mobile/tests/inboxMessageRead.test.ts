import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Booking, PickupProposal, TimeslotProposal } from '@toolshare/shared';

// appStorage pulls in the React Native / Expo SecureStore runtime, which does
// not exist under Node. Replace it with an in-memory key/value store so the
// read-bookkeeping logic can be exercised in isolation.
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
  inboxReadStorageKey,
  inboxReadSeedKey,
  requestMessageKey,
  proposalMessageKey,
  collectAllMessageKeys,
  loadReadMessageIds,
  saveReadMessageIds,
  countUnreadInboxThreads,
  bookingHasUnreadForUser,
  collectIncomingMessageKeys,
  seedReadMessagesIfNeeded,
  markThreadReadForUser,
} from '../utils/inboxMessageRead';

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

function pickup(overrides: Partial<PickupProposal> = {}): PickupProposal {
  return {
    id: 'p1',
    proposedById: 'provider',
    proposedPickupIso: '2026-06-10T09:00:00.000Z',
    status: 'PENDING',
    createdIso: '2026-06-02T10:00:00.000Z',
    ...overrides,
  };
}

function timeslot(overrides: Partial<TimeslotProposal> = {}): TimeslotProposal {
  return {
    id: 't1',
    proposedById: 'provider',
    proposedStartIso: '2026-06-10T10:00:00.000Z',
    proposedEndIso: '2026-06-10T12:00:00.000Z',
    status: 'PENDING',
    createdIso: '2026-06-02T10:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  memory.clear();
  vi.clearAllMocks();
});

describe('storage key helpers', () => {
  it('namespaces and sanitizes the read-message key', () => {
    expect(inboxReadStorageKey('user-1')).toBe('toolshare.inbox.readMsgs.v1.user-1');
    expect(inboxReadStorageKey('a/b c')).toBe('toolshare.inbox.readMsgs.v1.a_b_c');
  });

  it('builds distinct seed and message keys', () => {
    expect(inboxReadSeedKey('u1')).toBe('toolshare.inbox.readSeed.v1.u1');
    expect(requestMessageKey('b1')).toBe('req:b1');
    expect(proposalMessageKey('b1', 'p9')).toBe('prop:b1:p9');
  });
});

describe('collectAllMessageKeys', () => {
  it('collects request and proposal keys across bookings', () => {
    const keys = collectAllMessageKeys([
      booking({
        id: 'b1',
        pickupProposals: [pickup({ id: 'p1' })],
        timeslotProposals: [timeslot({ id: 't1' })],
      }),
      booking({ id: 'b2' }),
    ]);
    expect(keys).toEqual(['req:b1', 'prop:b1:p1', 'prop:b1:t1', 'req:b2']);
  });
});

describe('loadReadMessageIds / saveReadMessageIds', () => {
  it('returns an empty set when nothing is stored', async () => {
    const ids = await loadReadMessageIds('u1');
    expect(ids.size).toBe(0);
  });

  it('round-trips a set of ids', async () => {
    await saveReadMessageIds('u1', new Set(['req:b1', 'prop:b1:p1']));
    const ids = await loadReadMessageIds('u1');
    expect([...ids].sort()).toEqual(['prop:b1:p1', 'req:b1']);
  });

  it('ignores corrupt stored values', async () => {
    memory.set(inboxReadStorageKey('u1'), 'not json');
    expect((await loadReadMessageIds('u1')).size).toBe(0);

    memory.set(inboxReadStorageKey('u1'), JSON.stringify({ not: 'an array' }));
    expect((await loadReadMessageIds('u1')).size).toBe(0);
  });
});

describe('bookingHasUnreadForUser', () => {
  it('is unread for the provider when the request has not been read', () => {
    expect(bookingHasUnreadForUser(booking(), 'provider', new Set())).toBe(true);
  });

  it('is read once the request key is marked', () => {
    expect(
      bookingHasUnreadForUser(booking(), 'provider', new Set(['req:b1']))
    ).toBe(false);
  });

  it('is never unread for the requester from their own request', () => {
    expect(bookingHasUnreadForUser(booking(), 'requester', new Set())).toBe(false);
  });

  it('flags pending proposals from the other party', () => {
    const b = booking({
      pickupProposals: [pickup({ id: 'p1', proposedById: 'provider' })],
    });
    // requester has read the request but not the incoming proposal
    expect(bookingHasUnreadForUser(b, 'requester', new Set())).toBe(true);
    expect(
      bookingHasUnreadForUser(b, 'requester', new Set(['prop:b1:p1']))
    ).toBe(false);
  });

  it('ignores non-pending proposals', () => {
    const b = booking({
      requesterId: 'requester',
      timeslotProposals: [timeslot({ id: 't1', status: 'ACCEPTED', proposedById: 'provider' })],
    });
    expect(
      bookingHasUnreadForUser(b, 'requester', new Set(['req:b1']))
    ).toBe(false);
  });
});

describe('countUnreadInboxThreads', () => {
  it('counts each booking with unread content once', () => {
    const bookings = [
      booking({ id: 'b1' }),
      booking({ id: 'b2' }),
      booking({ id: 'b3', requesterId: 'provider' }), // own request -> read
    ];
    expect(countUnreadInboxThreads(bookings, 'provider', new Set())).toBe(2);
  });
});

describe('collectIncomingMessageKeys', () => {
  it('returns no keys for system warnings', () => {
    expect(
      collectIncomingMessageKeys(booking({ type: 'SYSTEM_WARNING' }), 'requester')
    ).toEqual([]);
  });

  it('collects only incoming (other-party) pending keys', () => {
    const b = booking({
      pickupProposals: [
        pickup({ id: 'p1', proposedById: 'provider' }), // incoming for the requester
        pickup({ id: 'p2', proposedById: 'requester' }), // own proposal -> excluded
      ],
    });
    // The requester made the request, so 'req:b1' is their own -> only the
    // provider's pending proposal counts as incoming.
    expect(collectIncomingMessageKeys(b, 'requester')).toEqual(['prop:b1:p1']);
  });

  it('includes the request key for the provider (the other party)', () => {
    expect(collectIncomingMessageKeys(booking(), 'provider')).toEqual(['req:b1']);
  });
});

describe('seedReadMessagesIfNeeded', () => {
  it('seeds all keys on first run and records the seed flag', async () => {
    const bookings = [booking({ id: 'b1', pickupProposals: [pickup({ id: 'p1' })] })];
    const seeded = await seedReadMessagesIfNeeded('u1', bookings);
    expect(seeded).not.toBeNull();
    expect(seeded!.has('req:b1')).toBe(true);
    expect(seeded!.has('prop:b1:p1')).toBe(true);
    expect(memory.get(inboxReadSeedKey('u1'))).toBe('1');
  });

  it('is a no-op once already seeded', async () => {
    await seedReadMessagesIfNeeded('u1', [booking()]);
    const second = await seedReadMessagesIfNeeded('u1', [booking({ id: 'b2' })]);
    expect(second).toBeNull();
  });
});

describe('markThreadReadForUser', () => {
  it('marks incoming keys as read and returns the updated set', async () => {
    // The provider has an incoming request (it was created by the requester).
    const next = await markThreadReadForUser('provider', booking());
    expect(next).not.toBeNull();
    expect(next!.has('req:b1')).toBe(true);
    expect([...(await loadReadMessageIds('provider'))]).toContain('req:b1');
  });

  it('returns null when there is nothing incoming to mark', async () => {
    // The requester's own request produces no incoming keys.
    expect(await markThreadReadForUser('requester', booking())).toBeNull();
  });

  it('returns null when everything is already read', async () => {
    await saveReadMessageIds('provider', new Set(['req:b1']));
    expect(await markThreadReadForUser('provider', booking())).toBeNull();
  });
});
