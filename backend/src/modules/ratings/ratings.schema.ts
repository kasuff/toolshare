import { z } from "zod";

export const createRatingSchema = z.object({
  body: z.object({
    bookingId: z.string().uuid(),
    toUserId: z.string().uuid(),
    score: z.number().int().min(1).max(5),
    comment: z.string().max(1500).optional()
  }),
  params: z.object({}),
  query: z.object({})
});

export const ratingsForUserSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});