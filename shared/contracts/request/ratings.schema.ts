import { z } from "zod";

export const createRatingBodySchema = z.object({
  bookingId: z.string().uuid(),
  score: z.number().int().min(1).max(5),
  comment: z.string().max(1500).optional()
});

export type CreateRatingBody = z.infer<typeof createRatingBodySchema>;
