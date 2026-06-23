import { AppError } from "../../utils/app-error";
import { ratingsRepository } from "./ratings.repository";
import {
  toPublicRatingResponseList,
  toRatingResponse,
  toRatingResponseList
} from "./ratings.presenter";

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
  async listReceived(userId: string) {
    const ratings = await ratingsRepository.listReceived(userId);
    return toRatingResponseList(ratings);
  },

  async listGiven(userId: string) {
    const ratings = await ratingsRepository.listGiven(userId);
    return toRatingResponseList(ratings);
  },

  async listForTool(toolId: string) {
    const ratings = await ratingsRepository.listForTool(toolId);
    return toPublicRatingResponseList(ratings);
  },

  async listForWorkshop(workshopId: string) {
    const ratings = await ratingsRepository.listForWorkshop(workshopId);
    return toPublicRatingResponseList(ratings);
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

    const starsLabel = input.score === 1 ? "1 Stern" : `${input.score} Sterne`;
    const rating = await ratingsRepository.createWithNotification({
      bookingId: input.bookingId,
      fromUserId: input.fromUserId,
      toUserId: providerUserId,
      score: input.score,
      comment: input.comment?.trim() || undefined,
      starsLabel
    });
    return toRatingResponse(rating);
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
  },

  async removeFromModeration(ratingId: string) {
    const rating = await ratingsRepository.findById(ratingId);
    if (!rating) {
      throw new AppError("RATING_NOT_FOUND", "Rating not found", 404);
    }
    await ratingsRepository.remove(ratingId);
    return rating;
  }
};
