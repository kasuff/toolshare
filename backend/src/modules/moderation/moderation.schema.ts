import { z } from "zod";

export const createReportSchema = z.object({
  body: z.object({
    bookingId: z.string().uuid().optional(),
    reason: z.string().min(5),
    details: z.string().max(1500).optional()
  }),
  params: z.object({}),
  query: z.object({})
});

export const updateReportSchema = z.object({
  body: z.object({
    status: z.enum(["IN_REVIEW", "RESOLVED", "REJECTED"])
  }),
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});
