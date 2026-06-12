import type { Booking } from "../types/domain";

type CompletionBooking = Pick<Booking, "type" | "status" | "providerId" | "endIso">;

export function canProviderCompleteBooking(
  booking: CompletionBooking,
  currentUserId: string,
  now = Date.now()
): boolean {
  if (booking.providerId !== currentUserId || booking.status !== "BESTAETIGT") {
    return false;
  }
  if (booking.type === "TOOL") {
    return true;
  }
  if (!booking.endIso) {
    return false;
  }
  return new Date(booking.endIso).getTime() <= now;
}
