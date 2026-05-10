import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/require-role";
import { validate } from "../../middleware/validate";
import { moderationController } from "./moderation.controller";
import { createReportSchema, updateReportSchema } from "./moderation.schema";

export const moderationRouter = Router();

moderationRouter.use(requireAuth);
moderationRouter.post("/reports", validate(createReportSchema), moderationController.createReport);
moderationRouter.get("/reports", requireRole("MODERATOR", "MANAGER"), moderationController.listReports);
moderationRouter.patch(
  "/reports/:id",
  requireRole("MODERATOR","MANAGER"),
  validate(updateReportSchema),
  moderationController.updateStatus
);
