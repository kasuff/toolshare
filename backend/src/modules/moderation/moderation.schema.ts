import { z } from "zod";

export const createReportSchema = z.object({
  body: z.object({
    targetType: z.enum(["TOOL", "WORKSHOP", "USER"]),
    targetId: z.string().uuid(),
    bookingId: z.string().uuid().optional(),
    reason: z.string().min(5),
    details: z.string().max(1500).optional(),
    conversationContext: z.string().max(10000).optional()
  }),
  params: z.object({}),
  query: z.object({})
});

export const updateReportSchema = z.object({
  body: z.object({
    status: z.enum(["IN_REVIEW", "RESOLVED", "REJECTED"]),
    decisionNote: z.string().min(3).max(1500).optional(),
    warnUserId: z.string().uuid().optional(),
    warningReason: z.string().min(3).max(600).optional(),
    requestSuspensionUserId: z.string().uuid().optional(),
    suspensionReason: z.string().min(3).max(600).optional()
  }),
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});
