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

export const suspensionRequestResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  requestedById: z.string().uuid(),
  reportId: z.string().uuid().nullable(),
  reason: z.string(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  createdAt: z.string(),
  user: z.object({ id: z.string().uuid(), name: z.string(), email: z.string(), isSuspended: z.boolean() }),
  requestedBy: z.object({ id: z.string().uuid(), name: z.string() }),
  report: z.object({
    id: z.string().uuid(),
    reason: z.string(),
    targetType: reportTargetTypeSchema,
    targetId: z.string()
  }).nullable().optional()
});

export const suspensionRequestListResponseSchema = z.array(suspensionRequestResponseSchema);

export type ModerationReportResponse = z.infer<typeof moderationReportResponseSchema>;
export type SuspensionRequestResponse = z.infer<typeof suspensionRequestResponseSchema>;
