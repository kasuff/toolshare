import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { bookingsController } from "./bookings.controller";
import {
  createToolBookingSchema,
  createWorkshopBookingSchema,
  updateBookingStatusSchema
} from "./bookings.schema";

export const bookingsRouter = Router();

bookingsRouter.use(requireAuth);
bookingsRouter.get("/me", bookingsController.listMine);
bookingsRouter.post("/tool", validate(createToolBookingSchema), bookingsController.createToolBooking);
bookingsRouter.post("/workshop", validate(createWorkshopBookingSchema), bookingsController.createWorkshopBooking);
bookingsRouter.patch("/:id/status", validate(updateBookingStatusSchema), bookingsController.updateStatus);
