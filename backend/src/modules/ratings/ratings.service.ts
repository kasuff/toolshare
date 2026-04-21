import { AppError } from "../../utils/app-error";
import { notificationsRepository } from "../notifications/notifications.repository";
import { ratingsRepository } from "./ratings.repository";

export const ratingsService = {
  listReceived(userId: string) {
    return ratingsRepository.listReceived(userId);
  },

  listGiven(userId: string) {
    return ratingsRepository.listGiven(userId);
  },

  async create(input: {
    bookingId: string;
    fromUserId: string;
    toUserId: string;
    score: number;
    comment?: string;
  }) {
    if (input.fromUserId === input.toUserId) {
      throw new AppError("INVALID_RATING_TARGET", "Users cannot rate themselves", 400);
    }

    const booking = await ratingsRepository.findBookingWithParticipants(input.bookingId);
    if (!booking) {
      throw new AppError("BOOKING_NOT_FOUND", "Booking not found", 404);
    }

    const participants = [booking.userId, booking.tool?.ownerId, booking.timeslot?.workshop.managerId].filter(
      (value): value is string => typeof value === "string"
    );

    const fromParticipant = participants.includes(input.fromUserId);
    const toParticipant = participants.includes(input.toUserId);
    if (!fromParticipant || !toParticipant) {
      throw new AppError("FORBIDDEN", "Ratings are only allowed between booking participants", 403);
    }

    const bookingFinished = booking.status === "RETURNED" || booking.endDate <= new Date();
    if (!bookingFinished) {
      throw new AppError(
        "RATING_NOT_ALLOWED",
        "Rating is only allowed after the booking period has finished",
        409
      );
    }

    const existing = await ratingsRepository.findExisting(
      input.bookingId,
      input.fromUserId,
      input.toUserId
    );
    if (existing) {
      throw new AppError("RATING_ALREADY_EXISTS", "Rating already exists for this booking pair", 409);
    }

    const rating = await ratingsRepository.create(input);
    await notificationsRepository.create(input.toUserId, "Du hast eine neue Bewertung erhalten.");
    return rating;
  }
};