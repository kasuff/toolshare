import { z } from "zod";

export const ratingStatusSchema = z.enum(["VISIBLE", "HIDDEN"]);

const ratingUserRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string()
});

const ratingBookingRefSchema = z.object({
  id: z.string().uuid().optional(),
  status: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  toolId: z.string().uuid().nullable().optional(),
  tool: z
    .object({ id: z.string().uuid(), name: z.string() })
    .nullable()
    .optional(),
  timeslot: z
    .object({
      workshopId: z.string().uuid().optional(),
      workshop: z
        .object({ id: z.string().uuid(), name: z.string() })
        .nullable()
        .optional()
    })
    .nullable()
    .optional()
});

export const ratingResponseSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  fromUserId: z.string().uuid(),
  toUserId: z.string().uuid(),
  score: z.number(),
  comment: z.string().nullable().optional(),
  status: ratingStatusSchema,
  createdAt: z.string(),
  fromUser: ratingUserRefSchema.nullable().optional(),
  toUser: ratingUserRefSchema.nullable().optional(),
  booking: ratingBookingRefSchema.nullable().optional()
});

export const ratingListResponseSchema = z.array(ratingResponseSchema);

// Oeffentliche Tool-/Workshop-Bewertungen: keine internen IDs der Beteiligten,
// nur der Anzeigename des Bewertenden.
export const publicRatingResponseSchema = z.object({
  id: z.string().uuid(),
  score: z.number(),
  comment: z.string().nullable().optional(),
  createdAt: z.string(),
  fromUser: z.object({ name: z.string() }).nullable().optional()
});

export const publicRatingListResponseSchema = z.array(publicRatingResponseSchema);

export type RatingResponse = z.infer<typeof ratingResponseSchema>;
export type PublicRatingResponse = z.infer<typeof publicRatingResponseSchema>;
