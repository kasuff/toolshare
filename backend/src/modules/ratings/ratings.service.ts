import { AppError } from "../../utils/app-error";
import { notificationsRepository } from "../notifications/notifications.repository";
import { ratingsRepository } from "./ratings.repository";

function getProviderUserId(booking: NonNullable<Awaited<ReturnType<typeof ratingsRepository.findBookingWithParticipants>>>) {
  if (booking.tool?.ownerId) {
    return booking.tool.ownerId;
  }
  if (booking.timeslot?.workshop?.managerId) {
    return booking.timeslot.workshop.managerId;
  }
  return null;
}

function isBookingFinished(booking: { status: string; endDate: Date }) {
  return booking.status === "RETURNED" || booking.endDate <= new Date();
}

export const ratingsService = {
  listReceived(userId: string) {
    return ratingsRepository.listReceived(userId);
  },

  listGiven(userId: string) {
    return ratingsRepository.listGiven(userId);
  },

  listForTool(toolId: string) {
    return ratingsRepository.listForTool(toolId);
  },

  listForWorkshop(workshopId: string) {
    return ratingsRepository.listForWorkshop(workshopId);
  },

  async create(input: {
    bookingId: string;
    fromUserId: string;
    score: number;
    comment?: string;
  }) {
    const booking = await ratingsRepository.findBookingWithParticipants(input.bookingId);
    if (!booking) {
      throw new AppError("BOOKING_NOT_FOUND", "Booking not found", 404);
    }

    if (booking.userId !== input.fromUserId) {
      throw new AppError("FORBIDDEN", "Only the requester can submit a rating", 403);
    }

    const providerUserId = getProviderUserId(booking);
    if (!providerUserId) {
      throw new AppError("INVALID_BOOKING", "Booking has no provider", 400);
    }

    if (!isBookingFinished(booking)) {
      throw new AppError(
        "RATING_NOT_ALLOWED",
        "Rating is only allowed after the booking period has finished",
        409
      );
    }

    const existing = await ratingsRepository.findByBookingAndRequester(input.bookingId, input.fromUserId);
    if (existing) {
      throw new AppError("RATING_ALREADY_EXISTS", "Rating already exists for this booking", 409);
    }

    const rating = await ratingsRepository.create({
      bookingId: input.bookingId,
      fromUserId: input.fromUserId,
      toUserId: providerUserId,
      score: input.score,
      comment: input.comment?.trim() || undefined
    });

    const starsLabel = input.score === 1 ? "1 Stern" : `${input.score} Sterne`;
    await notificationsRepository.create(providerUserId, `Du hast eine neue Bewertung erhalten (${starsLabel}).`);
    return rating;
  },

  async hideFromModeration(ratingId: string, moderatorId: string, decisionNote?: string) {
    const rating = await ratingsRepository.findById(ratingId);
    if (!rating) {
      throw new AppError("RATING_NOT_FOUND", "Rating not found", 404);
    }
    if (rating.status === "HIDDEN") {
      return rating;
    }
    return ratingsRepository.hide(ratingId, moderatorId, decisionNote);
  }
};
