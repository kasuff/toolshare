import type { Booking, PickupProposal, TimeslotProposal } from '@toolshare/shared';

export type DraftToolRangeParts = {
  pickupDate: string;
  pickupTime: string;
  returnDate: string;
  returnTime: string;
};

export type DraftWorkshopRangeParts = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
};

export function getPendingPickupProposal(booking: Booking): PickupProposal | null {
  const pending = (booking.pickupProposals ?? []).filter((p) => p.status === 'PENDING');
  return pending.length > 0 ? pending[pending.length - 1] : null;
}

export function getPendingTimeslotProposal(booking: Booking): TimeslotProposal | null {
  const pending = (booking.timeslotProposals ?? []).filter((p) => p.status === 'PENDING');
  return pending.length > 0 ? pending[pending.length - 1] : null;
}

function splitIsoToLocalParts(iso: string): { date: string; time: string } {
  if (!iso.trim()) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  const pad = (value: number) => `${value}`.padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function toToolRangeDraft(booking: Booking): DraftToolRangeParts {
  const latest = booking.pickupProposals?.length
    ? booking.pickupProposals[booking.pickupProposals.length - 1]
    : null;
  const pickup = splitIsoToLocalParts(latest?.proposedPickupIso ?? booking.pickupTimeIso ?? booking.startIso ?? '');
  const returnTime = splitIsoToLocalParts(latest?.proposedReturnIso ?? booking.endIso ?? '');
  return {
    pickupDate: pickup.date,
    pickupTime: pickup.time,
    returnDate: returnTime.date,
    returnTime: returnTime.time,
  };
}

export function toWorkshopDraft(booking: Booking): DraftWorkshopRangeParts {
  const latest = booking.timeslotProposals?.length
    ? booking.timeslotProposals[booking.timeslotProposals.length - 1]
    : null;
  const startIso = latest?.proposedStartIso ?? booking.startIso ?? '';
  const endIso = latest?.proposedEndIso ?? booking.endIso ?? '';
  const startParts = splitIsoToLocalParts(startIso);
  const endParts = splitIsoToLocalParts(endIso);
  if (!startParts.date) {
    const now = new Date();
    now.setDate(now.getDate() + 1);
    const end = new Date(now);
    end.setHours(end.getHours() + 2);
    const pad = (value: number) => `${value}`.padStart(2, '0');
    return {
      startDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      startTime: '10:00',
      endDate: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
      endTime: '12:00',
    };
  }
  return {
    startDate: startParts.date,
    startTime: startParts.time || '10:00',
    endDate: endParts.date || startParts.date,
    endTime: endParts.time || '12:00',
  };
}

export function combineLocalDateTimeToIso(date: string, time: string): string | null {
  const dStr = date.trim();
  const tStr = time.trim();
  if (!dStr || !tStr) return null;
  const [y, m, day] = dStr.split('-').map(Number);
  const timeParts = tStr.split(':');
  const hh = Number(timeParts[0]);
  const mm = Number(timeParts[1] ?? 0);
  if (!y || !m || !day || Number.isNaN(hh) || Number.isNaN(mm)) return null;
  const dt = new Date(y, m - 1, day, hh, mm, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}
