import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { moderationService } from "./moderation.service";
import { toModerationReportResponse } from "./moderation.presenter";

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
    const results = await moderationService.listReports();
    const reports = results.map(r => toModerationReportResponse(r.report, r.context));
    res.status(200).json(reports);
  }),

  listClosedReports: asyncHandler(async (_req: Request, res: Response) => {
    const results = await moderationService.listClosedReports();
    const reports = results.map(r => toModerationReportResponse(r.report, r.context));
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
      suspensionReason: req.body.suspensionReason,
      deleteTool: req.body.deleteTool,
      deleteWorkshop: req.body.deleteWorkshop,
      deleteRating: req.body.deleteRating
    });
    res.status(200).json(report);
  })
};
