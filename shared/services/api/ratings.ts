import type { PublicRating, Rating } from "../../types/domain";
import type { BackendRating } from "./types";
import { request } from "./client";
import { mapPublicRating, mapRating } from "./mappers";

export const ratingsApi = {
  async createRating(
    input: { bookingId: string; score: number; comment?: string },
    token: string
  ) {
    return request<BackendRating>(
      "/ratings",
      {
        method: "POST",
        body: JSON.stringify({
          bookingId: input.bookingId,
          score: input.score,
          comment: input.comment?.trim() || undefined
        })
      },
      token
    );
  },

  async getRatingsReceived(token: string) {
    const ratings = await request<BackendRating[]>("/ratings/me/received", undefined, token);
    return ratings.map(mapRating);
  },

  async getRatingsGiven(token: string) {
    const ratings = await request<BackendRating[]>("/ratings/me/given", undefined, token);
    return ratings.map(mapRating);
  },

  async getRatingsForTool(toolId: string) {
    const ratings = await request<BackendRating[]>(`/ratings/tools/${toolId}`);
    return ratings.map(mapPublicRating);
  },

  async getRatingsForWorkshop(workshopId: string) {
    const ratings = await request<BackendRating[]>(`/ratings/workshops/${workshopId}`);
    return ratings.map(mapPublicRating);
  },

};
