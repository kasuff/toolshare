import { describe, expect, it } from "vitest";
import {
  publicRatingResponseSchema,
  ratingResponseSchema
} from "@toolshare/shared/contracts/response/ratings.schema";
import {
  toPublicRatingResponse,
  toRatingResponse
} from "../../src/modules/ratings/ratings.presenter";
import type { RatingEntity } from "../../src/modules/ratings/ratings.entity";

const sampleRating: RatingEntity = {
  id: "11111111-1111-1111-1111-111111111111",
  bookingId: "22222222-2222-2222-2222-222222222222",
  fromUserId: "33333333-3333-3333-3333-333333333333",
  toUserId: "44444444-4444-4444-4444-444444444444",
  score: 5,
  comment: "Top",
  status: "VISIBLE",
  createdAt: new Date("2026-06-20T08:00:00.000Z"),
  fromUser: { id: "33333333-3333-3333-3333-333333333333", name: "Lea", role: "USER" },
  toUser: { id: "44444444-4444-4444-4444-444444444444", name: "Max", role: "USER" },
  booking: {
    id: "22222222-2222-2222-2222-222222222222",
    status: "RETURNED",
    startDate: new Date("2026-06-10T08:00:00.000Z"),
    endDate: new Date("2026-06-12T08:00:00.000Z"),
    toolId: "55555555-5555-5555-5555-555555555555",
    tool: { id: "55555555-5555-5555-5555-555555555555", name: "Bohrer" }
  }
};

describe("ratings contracts", () => {
  it("rating presenter output matches ratingResponseSchema", () => {
    const response = toRatingResponse(sampleRating);
    expect(() => ratingResponseSchema.parse(response)).not.toThrow();
  });

  it("public rating presenter exposes only public fields", () => {
    const response = toPublicRatingResponse(sampleRating);
    expect(() => publicRatingResponseSchema.parse(response)).not.toThrow();
    expect(response).not.toHaveProperty("fromUserId");
    expect(response).not.toHaveProperty("toUserId");
    expect(response).not.toHaveProperty("bookingId");
    expect(response.fromUser).toEqual({ name: "Lea" });
  });
});
