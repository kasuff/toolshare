import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { bookingsService } from "./bookings.service";

export const bookingsController = {
  createToolBooking: asyncHandler(async (req: Request, res: Response) => {
    const booking = await bookingsService.createToolBooking({
      requesterId: req.authUser!.userId,
      toolId: req.body.toolId,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      pickupTime: req.body.pickupTime
    });
    res.status(201).json(booking);
  }),

  createWorkshopBooking: asyncHandler(async (req: Request, res: Response) => {
    const booking = await bookingsService.createWorkshopBooking({
      requesterId: req.authUser!.userId,
      timeslotId: req.body.timeslotId
    });
    res.status(201).json(booking);
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const updated = await bookingsService.updateBookingStatus({
      actorId: req.authUser!.userId,
      actorRole: req.authUser!.role,
      bookingId: req.params.id,
      status: req.body.status as "PENDING" | "ACCEPTED" | "REJECTED" | "RETURNED"
    });
    res.status(200).json(updated);
  })
};
