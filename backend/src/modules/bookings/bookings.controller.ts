import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { bookingsService } from "./bookings.service";

export const bookingsController = {
  listMine: asyncHandler(async (req: Request, res: Response) => {
    const bookings = await bookingsService.listForUserContext(req.authUser!.userId);
    res.status(200).json(bookings);
  }),

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

  createToolOwnerBlock: asyncHandler(async (req: Request, res: Response) => {
    const booking = await bookingsService.createToolOwnerBlock({
      ownerId: req.authUser!.userId,
      toolId: req.body.toolId,
      startDate: req.body.startDate,
      endDate: req.body.endDate
    });
    res.status(201).json(booking);
  }),

  createWorkshopBooking: asyncHandler(async (req: Request, res: Response) => {
    const booking = await bookingsService.createWorkshopBooking({
      requesterId: req.authUser!.userId,
      workshopId: req.body.workshopId,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      workshopToolIds: req.body.workshopToolIds
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
  }),

  createPickupProposal: asyncHandler(async (req: Request, res: Response) => {
    const created = await bookingsService.createPickupProposal({
      actorId: req.authUser!.userId,
      bookingId: req.params.id as string,
      pickupTime: req.body.pickupTime as string,
      returnTime: req.body.returnTime as string
    });
    res.status(201).json(created);
  }),

  respondPickupProposal: asyncHandler(async (req: Request, res: Response) => {
    const updated = await bookingsService.respondPickupProposal({
      actorId: req.authUser!.userId,
      bookingId: req.params.id as string,
      proposalId: req.params.proposalId as string,
      decision: req.body.decision as "ACCEPT" | "DECLINE"
    });
    res.status(200).json(updated);
  }),

  createTimeslotProposal: asyncHandler(async (req: Request, res: Response) => {
    const created = await bookingsService.createTimeslotProposal({
      actorId: req.authUser!.userId,
      bookingId: req.params.id as string,
      startDate: req.body.startDate as string,
      endDate: req.body.endDate as string
    });
    res.status(201).json(created);
  }),

  respondTimeslotProposal: asyncHandler(async (req: Request, res: Response) => {
    const updated = await bookingsService.respondTimeslotProposal({
      actorId: req.authUser!.userId,
      bookingId: req.params.id as string,
      proposalId: req.params.proposalId as string,
      decision: req.body.decision as "ACCEPT" | "DECLINE"
    });
    res.status(200).json(updated);
  })
};
