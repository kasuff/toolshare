import type {
  PublicRatingResponse,
  RatingResponse
} from "@toolshare/shared/contracts/response/ratings.schema";
import type { RatingEntity } from "./ratings.entity";

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : String(value);
const isoOpt = (value: Date | string | null | undefined): string | undefined =>
  value == null ? undefined : value instanceof Date ? value.toISOString() : String(value);

export function toRatingResponse(rating: RatingEntity): RatingResponse {
  return {
    id: rating.id,
    bookingId: rating.bookingId,
    fromUserId: rating.fromUserId,
    toUserId: rating.toUserId,
    score: rating.score,
    comment: rating.comment ?? null,
    status: rating.status,
    createdAt: iso(rating.createdAt),
    fromUser: rating.fromUser ? { id: rating.fromUser.id, name: rating.fromUser.name } : undefined,
    toUser: rating.toUser ? { id: rating.toUser.id, name: rating.toUser.name } : undefined,
    booking: rating.booking
      ? {
          id: rating.booking.id,
          status: rating.booking.status,
          startDate: isoOpt(rating.booking.startDate),
          endDate: isoOpt(rating.booking.endDate),
          toolId: rating.booking.toolId ?? undefined,
          tool: rating.booking.tool
            ? { id: rating.booking.tool.id, name: rating.booking.tool.name }
            : undefined,
          timeslot: rating.booking.timeslot
            ? {
                workshopId: rating.booking.timeslot.workshopId,
                workshop: rating.booking.timeslot.workshop
                  ? {
                      id: rating.booking.timeslot.workshop.id,
                      name: rating.booking.timeslot.workshop.name
                    }
                  : undefined
              }
            : undefined
        }
      : undefined
  };
}

export function toRatingResponseList(ratings: RatingEntity[]): RatingResponse[] {
  return ratings.map(toRatingResponse);
}

export function toPublicRatingResponse(rating: RatingEntity): PublicRatingResponse {
  return {
    id: rating.id,
    score: rating.score,
    comment: rating.comment ?? null,
    createdAt: iso(rating.createdAt),
    fromUser: rating.fromUser ? { name: rating.fromUser.name } : undefined
  };
}

export function toPublicRatingResponseList(ratings: RatingEntity[]): PublicRatingResponse[] {
  return ratings.map(toPublicRatingResponse);
}
