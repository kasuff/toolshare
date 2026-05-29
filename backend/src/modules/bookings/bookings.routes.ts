import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { bookingsController } from "./bookings.controller";
import {
  createPickupProposalSchema,
  createToolBookingSchema,
  createWorkshopBookingSchema,
  respondPickupProposalSchema,
  updateBookingStatusSchema
} from "./bookings.schema";

export const bookingsRouter = Router();

bookingsRouter.use(requireAuth);
bookingsRouter.get("/me", bookingsController.listMine);
bookingsRouter.post("/tool", validate(createToolBookingSchema), bookingsController.createToolBooking);
bookingsRouter.post("/workshop", validate(createWorkshopBookingSchema), bookingsController.createWorkshopBooking);
bookingsRouter.post(
  "/:id/pickup-proposals",
  validate(createPickupProposalSchema),
  bookingsController.createPickupProposal
);
bookingsRouter.patch(
  "/:id/pickup-proposals/:proposalId",
  validate(respondPickupProposalSchema),
  bookingsController.respondPickupProposal
);
bookingsRouter.patch("/:id/status", validate(updateBookingStatusSchema), bookingsController.updateStatus);
