import type { PublicRating, Rating } from "../../types/domain";
import { requestParsed } from "./client";
import {
  ratingResponseSchema,
  ratingListResponseSchema,
  publicRatingListResponseSchema
} from "../../contracts/response/ratings.schema";
import { mapPublicRating, mapRating } from "./mappers";

export const ratingsApi = {
  async createRating(input: { bookingId: string; score: number; comment?: string }, token: string) {
    return requestParsed(
      ratingResponseSchema,
      "/ratings",
      { method: "POST", body: JSON.stringify({ bookingId: input.bookingId, score: input.score, comment: input.comment?.trim() || undefined }) },
      token
    );
  },

  async getRatingsReceived(token: string): Promise<Rating[]> {
    const ratings = await requestParsed(ratingListResponseSchema, "/ratings/me/received", undefined, token);
    return ratings.map(mapRating);
  },

  async getRatingsGiven(token: string): Promise<Rating[]> {
    const ratings = await requestParsed(ratingListResponseSchema, "/ratings/me/given", undefined, token);
    return ratings.map(mapRating);
  },

  async getRatingsForTool(toolId: string): Promise<PublicRating[]> {
    const ratings = await requestParsed(publicRatingListResponseSchema, `/ratings/tools/${toolId}`);
    return ratings.map(mapPublicRating);
  },

  async getRatingsForWorkshop(workshopId: string): Promise<PublicRating[]> {
    const ratings = await requestParsed(publicRatingListResponseSchema, `/ratings/workshops/${workshopId}`);
    return ratings.map(mapPublicRating);
  }
};
