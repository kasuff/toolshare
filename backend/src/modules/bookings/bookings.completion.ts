import { AppError } from "../../utils/app-error";

type CompletionBooking = {
  status: string;
  endDate: Date;
  tool?: { ownerId: string } | null;
  timeslot?: { workshop?: { managerId: string } | null } | null;
};

type CompletionActor = {
  actorId: string;
  actorRole: "USER" | "MODERATOR" | "MANAGER";
};

export function assertBookingCanBeCompleted(
  booking: CompletionBooking,
  actor: CompletionActor,
  now = Date.now()
): void {
  const providerId = booking.tool?.ownerId ?? booking.timeslot?.workshop?.managerId ?? null;
  const isProvider = providerId === actor.actorId;
  const isModeratorOrManager = actor.actorRole === "MODERATOR" || actor.actorRole === "MANAGER";

  if (!isProvider && !isModeratorOrManager) {
    throw new AppError("FORBIDDEN", "Only the provider can complete a booking", 403);
  }
  if (booking.status !== "ACCEPTED") {
    throw new AppError("INVALID_STATE", "Only accepted bookings can be completed", 400);
  }
  if (booking.timeslot && booking.endDate.getTime() > now) {
    throw new AppError("BOOKING_NOT_ENDED", "Booking can only be completed after the usage period has ended", 400);
  }
}
