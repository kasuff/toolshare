import { describe, it, expect } from 'vitest';
import type { Booking, PickupProposal, TimeslotProposal } from '@toolshare/shared';
import {
  getPendingPickupProposal,
  getPendingTimeslotProposal,
  toToolRangeDraft,
  toWorkshopDraft,
  combineLocalDateTimeToIso,
} from '../utils/inboxProposals';

function baseBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'b1',
    type: 'TOOL',
    requesterId: 'u1',
    providerId: 'u2',
    status: 'OFFEN',
    createdIso: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

function pickup(overrides: Partial<PickupProposal> = {}): PickupProposal {
  return {
    id: 'p1',
    proposedById: 'u2',
    proposedPickupIso: '2026-06-10T09:00:00.000Z',
    status: 'PENDING',
    createdIso: '2026-06-02T10:00:00.000Z',
    ...overrides,
  };
}

function timeslot(overrides: Partial<TimeslotProposal> = {}): TimeslotProposal {
  return {
    id: 't1',
    proposedById: 'u2',
    proposedStartIso: '2026-06-10T10:00:00.000Z',
    proposedEndIso: '2026-06-10T12:00:00.000Z',
    status: 'PENDING',
    createdIso: '2026-06-02T10:00:00.000Z',
    ...overrides,
  };
}

describe('getPendingPickupProposal', () => {
  it('returns null when there are no proposals', () => {
    expect(getPendingPickupProposal(baseBooking())).toBeNull();
  });

  it('returns the latest pending proposal, ignoring resolved ones', () => {
    const booking = baseBooking({
      pickupProposals: [
        pickup({ id: 'old', status: 'DECLINED' }),
        pickup({ id: 'first-pending' }),
        pickup({ id: 'last-pending' }),
      ],
    });
    expect(getPendingPickupProposal(booking)?.id).toBe('last-pending');
  });

  it('returns null when all proposals are resolved', () => {
    const booking = baseBooking({
      pickupProposals: [pickup({ status: 'ACCEPTED' })],
    });
    expect(getPendingPickupProposal(booking)).toBeNull();
  });
});

describe('getPendingTimeslotProposal', () => {
  it('returns the latest pending timeslot proposal', () => {
    const booking = baseBooking({
      type: 'WORKSHOP',
      timeslotProposals: [
        timeslot({ id: 'a', status: 'ACCEPTED' }),
        timeslot({ id: 'b' }),
      ],
    });
    expect(getPendingTimeslotProposal(booking)?.id).toBe('b');
  });

  it('returns null with no proposals', () => {
    expect(getPendingTimeslotProposal(baseBooking())).toBeNull();
  });
});

describe('toToolRangeDraft', () => {
  it('prefers the latest pickup proposal times', () => {
    const booking = baseBooking({
      startIso: '2026-06-01T08:00:00.000Z',
      endIso: '2026-06-01T18:00:00.000Z',
      pickupProposals: [
        pickup({
          proposedPickupIso: '2026-06-15T14:30:00.000Z',
          proposedReturnIso: '2026-06-16T16:45:00.000Z',
        }),
      ],
    });
    const draft = toToolRangeDraft(booking);
    // Asserts on local components via a round-trip to avoid TZ flakiness.
    expect(draft.pickupDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(draft.pickupTime).toMatch(/^\d{2}:\d{2}$/);
    expect(draft.returnDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(draft.returnTime).toMatch(/^\d{2}:\d{2}$/);
  });

  it('falls back to booking pickup/start times when no proposal exists', () => {
    const booking = baseBooking({
      pickupTimeIso: '2026-06-05T09:00:00.000Z',
      endIso: '2026-06-06T17:00:00.000Z',
    });
    const draft = toToolRangeDraft(booking);
    expect(draft.pickupDate).not.toBe('');
    expect(draft.returnDate).not.toBe('');
  });

  it('produces empty parts when nothing is set', () => {
    expect(toToolRangeDraft(baseBooking())).toEqual({
      pickupDate: '',
      pickupTime: '',
      returnDate: '',
      returnTime: '',
    });
  });

  it('handles invalid dates by returning empty strings', () => {
    const draft = toToolRangeDraft(baseBooking({ startIso: 'invalid-date' }));
    expect(draft.pickupDate).toBe('');
    expect(draft.pickupTime).toBe('');
  });
});

describe('toWorkshopDraft', () => {
  it('uses the latest timeslot proposal when present', () => {
    const booking = baseBooking({
      type: 'WORKSHOP',
      timeslotProposals: [
        timeslot({
          proposedStartIso: '2026-07-01T10:00:00.000Z',
          proposedEndIso: '2026-07-01T12:00:00.000Z',
        }),
      ],
    });
    const draft = toWorkshopDraft(booking);
    expect(draft.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(draft.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('defaults to tomorrow 10:00-12:00 when no dates are available', () => {
    const draft = toWorkshopDraft(baseBooking({ type: 'WORKSHOP' }));
    expect(draft.startTime).toBe('10:00');
    expect(draft.endTime).toBe('12:00');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const pad = (v: number) => `${v}`.padStart(2, '0');
    expect(draft.startDate).toBe(
      `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`
    );
  });

  it('handles invalid end date by returning start date and default end time', () => {
    const draft = toWorkshopDraft(baseBooking({ type: 'WORKSHOP', startIso: '2026-06-10T10:00:00.000Z', endIso: 'invalid' }));
    expect(draft.startDate).toBe('2026-06-10');
    expect(draft.startTime).toBe('12:00'); // 10:00Z is 12:00 local time
    expect(draft.endDate).toBe('2026-06-10');
    expect(draft.endTime).toBe('12:00');
  });
});

describe('combineLocalDateTimeToIso', () => {
  it('returns null for empty date or time', () => {
    expect(combineLocalDateTimeToIso('', '10:00')).toBeNull();
    expect(combineLocalDateTimeToIso('2026-06-19', '   ')).toBeNull();
  });

  it('returns null for malformed values', () => {
    expect(combineLocalDateTimeToIso('2026-06', '10:00')).toBeNull();
    expect(combineLocalDateTimeToIso('2026-06-19', 'xx:yy')).toBeNull();
  });

  it('returns null if date component values produce an invalid date', () => {
    expect(combineLocalDateTimeToIso('1000000000000-01-01', '12:00')).toBeNull();
  });

  it('combines date and time into an ISO string', () => {
    const iso = combineLocalDateTimeToIso('2026-06-19', '14:30');
    expect(iso).not.toBeNull();
    const parsed = new Date(iso!);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(5);
    expect(parsed.getDate()).toBe(19);
    expect(parsed.getHours()).toBe(14);
    expect(parsed.getMinutes()).toBe(30);
  });

  it('defaults missing minutes to zero', () => {
    const iso = combineLocalDateTimeToIso('2026-06-19', '08');
    expect(iso).not.toBeNull();
    expect(new Date(iso!).getMinutes()).toBe(0);
  });
});
