import { z } from "zod";

export const reportTargetTypeSchema = z.enum(["TOOL", "WORKSHOP", "USER", "RATING"]);
export const reportStatusSchema = z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "REJECTED"]);

export const ratingPreviewResponseSchema = z.object({
  score: z.number(),
  comment: z.string().nullable(),
  fromUserName: z.string(),
  listingLabel: z.string().nullable()
});

export const moderationReportResponseSchema = z.object({
  id: z.string().uuid(),
  reporterId: z.string().uuid(),
  reporterName: z.string(),
  targetType: reportTargetTypeSchema,
  targetId: z.string(),
  targetLabel: z.string(),
  targetHref: z.string().nullable(),
  subjectUserId: z.string().nullable(),
  subjectUserName: z.string().nullable(),
  ratingPreview: ratingPreviewResponseSchema.nullable(),
  bookingId: z.string().nullable().optional(),
  reason: z.string(),
  details: z.string().nullable().optional(),
  conversationContext: z.string().nullable().optional(),
  status: reportStatusSchema,
  decisionNote: z.string().nullable().optional(),
  decisionAt: z.string().nullable().optional(),
  moderatorId: z.string().nullable().optional(),
  moderatorName: z.string().nullable().optional(),
  createdAt: z.string()
});

export const moderationReportListResponseSchema = z.array(moderationReportResponseSchema);

export type ModerationReportResponse = z.infer<typeof moderationReportResponseSchema>;
