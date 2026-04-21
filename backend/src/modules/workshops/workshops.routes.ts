import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/require-role";
import { validate } from "../../middleware/validate";
import { workshopsController } from "./workshops.controller";
import {
  createTimeslotSchema,
  createWorkshopSchema,
  listWorkshopsSchema,
  removeTimeslotSchema,
  updateWorkshopSchema,
  workshopIdParamSchema
} from "./workshops.schema";

export const workshopsRouter = Router();

workshopsRouter.get("/", validate(listWorkshopsSchema), workshopsController.list);
workshopsRouter.get("/:id", validate(workshopIdParamSchema), workshopsController.getById);

workshopsRouter.post(
  "/",
  requireAuth,
  requireRole("MANAGER"),
  validate(createWorkshopSchema),
  workshopsController.create
);
workshopsRouter.patch(
  "/:id",
  requireAuth,
  requireRole("MANAGER"),
  validate(updateWorkshopSchema),
  workshopsController.update
);
workshopsRouter.delete(
  "/:id",
  requireAuth,
  requireRole("MANAGER"),
  validate(workshopIdParamSchema),
  workshopsController.remove
);

workshopsRouter.post(
  "/:id/timeslots",
  requireAuth,
  requireRole("MANAGER"),
  validate(createTimeslotSchema),
  workshopsController.createTimeslot
);
workshopsRouter.delete(
  "/:id/timeslots/:timeslotId",
  requireAuth,
  requireRole("MANAGER"),
  validate(removeTimeslotSchema),
  workshopsController.removeTimeslot
);