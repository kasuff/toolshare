import { describe, it, expect } from 'vitest';
import type { Booking, PickupProposal, TimeslotProposal } from '@toolshare/shared';

import {
  requestMessageKey,
  proposalMessageKey,
  collectAllMessageKeys,
  countUnreadInboxThreads,
  bookingHasUnreadForUser,
  collectIncomingMessageKeys,
} from '../utils/inboxMessageRead';

// Hinweis: Der Read-Status liegt seit der Server-Receipts-Umstellung nicht mehr im
// SecureStore (siehe store/inboxReadStore.ts). Hier werden nur noch die reinen,
// aus shared re-exportierten Key-/Zähl-Helfer getestet; Persistenz/Seeding sind
// jetzt Sache des Stores (Server-API) und werden dort/per Integrationstest geprüft.

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

describe('message key helpers', () => {
  it('builds request and proposal keys', () => {
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

  it('flags pending timeslot proposals from the other party', () => {
    const b = booking({
      timeslotProposals: [timeslot({ id: 't1', proposedById: 'provider' })],
    });
    expect(bookingHasUnreadForUser(b, 'requester', new Set())).toBe(true);
    expect(
      bookingHasUnreadForUser(b, 'requester', new Set(['prop:b1:t1']))
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

  it('collects pending timeslot proposals from the other party', () => {
    const b = booking({
      timeslotProposals: [timeslot({ id: 't1', proposedById: 'provider' })],
    });
    expect(collectIncomingMessageKeys(b, 'requester')).toEqual(['prop:b1:t1']);
  });

  it('includes the request key for the provider (the other party)', () => {
    expect(collectIncomingMessageKeys(booking(), 'provider')).toEqual(['req:b1']);
  });
});
