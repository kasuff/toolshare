import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { notificationsController } from "./notifications.controller";
import { markReadSchema } from "./notifications.schema";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);
notificationsRouter.get("/me", notificationsController.listMine);
notificationsRouter.patch("/:id/read", validate(markReadSchema), notificationsController.markRead);
