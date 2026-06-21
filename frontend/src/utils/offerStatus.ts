import type { Booking } from "@toolshare/shared";

export type OfferStatusBadge = {
  label: string;
  unavailable: boolean;
};

export function isActiveBooking(booking: Booking, now = Date.now()): boolean {
  if (booking.status !== "BESTAETIGT") {
    return false;
  }
  if (!booking.startIso || !booking.endIso) {
    return false;
  }
  const start = new Date(booking.startIso).getTime();
  const end = new Date(booking.endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return false;
  }
  return now >= start && now <= end;
}

export function isWorkshopCurrentlyInUse(
  workshopId: string,
  bookings: Booking[],
  now = Date.now()
): boolean {
  return bookings.some(
    (booking) =>
      booking.type === "WORKSHOP" &&
      booking.workshopId === workshopId &&
      isActiveBooking(booking, now)
  );
}

export function getToolStatusBadge(status: "VERFUEGBAR" | "AUSGELIEHEN"): OfferStatusBadge {
  if (status === "AUSGELIEHEN") {
    return { label: "Ausgeliehen", unavailable: true };
  }
  return { label: "Verfügbar", unavailable: false };
}

export function getWorkshopStatusBadge(inUse: boolean): OfferStatusBadge {
  if (inUse) {
    return { label: "In Nutzung", unavailable: true };
  }
  return { label: "Frei", unavailable: false };
}
