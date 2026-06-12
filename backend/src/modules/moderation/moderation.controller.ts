import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { moderationService } from "./moderation.service";

export const moderationController = {
  createReport: asyncHandler(async (req: Request, res: Response) => {
    const report = await moderationService.createReport({
      reporterId: req.authUser!.userId,
      targetType: req.body.targetType,
      targetId: req.body.targetId,
      bookingId: req.body.bookingId,
      reason: req.body.reason,
      details: req.body.details,
      conversationContext: req.body.conversationContext
    });
    res.status(201).json(report);
  }),

  listReports: asyncHandler(async (_req: Request, res: Response) => {
    const reports = await moderationService.listReports();
    res.status(200).json(reports);
  }),

  listClosedReports: asyncHandler(async (_req: Request, res: Response) => {
    const reports = await moderationService.listClosedReports();
    res.status(200).json(reports);
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const report = await moderationService.updateReportStatus({
      reportId: req.params.id,
      status: req.body.status as "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED",
      moderatorId: req.authUser!.userId,
      decisionNote: req.body.decisionNote,
      warnUserId: req.body.warnUserId,
      warningReason: req.body.warningReason,
      requestSuspensionUserId: req.body.requestSuspensionUserId,
      suspensionReason: req.body.suspensionReason
    });
    res.status(200).json(report);
  })
};
