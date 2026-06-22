import { z } from "zod";

export const createReportBodySchema = z.object({
  targetType: z.enum(["TOOL", "WORKSHOP", "USER", "RATING"]),
  targetId: z.string().uuid(),
  bookingId: z.string().uuid().optional(),
  reason: z.string().min(5),
  details: z.string().max(1500).optional(),
  conversationContext: z.string().max(10000).optional()
});

export const updateReportBodySchema = z.object({
  status: z.enum(["IN_REVIEW", "RESOLVED", "REJECTED"]),
  decisionNote: z.string().min(3).max(1500).optional(),
  warnUserId: z.string().uuid().optional(),
  warningReason: z.string().min(3).max(600).optional(),
  requestSuspensionUserId: z.string().uuid().optional(),
  suspensionReason: z.string().min(3).max(600).optional(),
  deleteTool: z.boolean().optional(),
  deleteWorkshop: z.boolean().optional(),
  deleteRating: z.boolean().optional()
});

export type CreateReportBody = z.infer<typeof createReportBodySchema>;
export type UpdateReportBody = z.infer<typeof updateReportBodySchema>;
