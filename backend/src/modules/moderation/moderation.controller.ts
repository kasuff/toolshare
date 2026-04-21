import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { moderationService } from "./moderation.service";

export const moderationController = {
  createReport: asyncHandler(async (req: Request, res: Response) => {
    const report = await moderationService.createReport({
      reporterId: req.authUser!.userId,
      bookingId: req.body.bookingId,
      reason: req.body.reason,
      details: req.body.details
    });
    res.status(201).json(report);
  }),

  listReports: asyncHandler(async (_req: Request, res: Response) => {
    const reports = await moderationService.listReports();
    res.status(200).json(reports);
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const report = await moderationService.updateReportStatus({
      reportId: req.params.id,
      status: req.body.status as "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED",
      moderatorId: req.authUser!.userId
    });
    res.status(200).json(report);
  })
};
