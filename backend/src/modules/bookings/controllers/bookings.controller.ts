import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/async-handler";
import { bookingsCreatedTotal } from "../../../utils/metrics";
import { bookingsService } from "../services/bookings.service";
import {
  toBookingPickupProposalResponse,
  toBookingResponse,
  toBookingResponseList,
  toBookingTimeslotProposalResponse
} from "./bookings.presenter";

export const bookingsController = {
  listMine: asyncHandler(async (req: Request, res: Response) => {
    const bookings = await bookingsService.listForUserContext(req.authUser!.userId);
    res.status(200).json(toBookingResponseList(bookings));
  }),

  createToolBooking: asyncHandler(async (req: Request, res: Response) => {
    const booking = await bookingsService.createToolBooking({
      requesterId: req.authUser!.userId,
      toolId: req.body.toolId,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      pickupTime: req.body.pickupTime
    });
    bookingsCreatedTotal.inc();
    res.status(201).json(toBookingResponse(booking));
  }),

  createToolOwnerBlock: asyncHandler(async (req: Request, res: Response) => {
    const booking = await bookingsService.createToolOwnerBlock({
      ownerId: req.authUser!.userId,
      toolId: req.body.toolId,
      startDate: req.body.startDate,
      endDate: req.body.endDate
    });
    res.status(201).json(toBookingResponse(booking));
  }),

  createWorkshopBooking: asyncHandler(async (req: Request, res: Response) => {
    const booking = await bookingsService.createWorkshopBooking({
      requesterId: req.authUser!.userId,
      workshopId: req.body.workshopId,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      workshopToolIds: req.body.workshopToolIds
    });
    bookingsCreatedTotal.inc();
    res.status(201).json(toBookingResponse(booking));
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const updated = await bookingsService.updateBookingStatus({
      actorId: req.authUser!.userId,
      actorRole: req.authUser!.role,
      bookingId: req.params.id,
      status: req.body.status as "PENDING" | "ACCEPTED" | "REJECTED" | "RETURNED"
    });
    res.status(200).json(toBookingResponse(updated));
  }),

  createPickupProposal: asyncHandler(async (req: Request, res: Response) => {
    const created = await bookingsService.createPickupProposal({
      actorId: req.authUser!.userId,
      bookingId: req.params.id as string,
      pickupTime: req.body.pickupTime as string,
      returnTime: req.body.returnTime as string
    });
    res.status(201).json(toBookingPickupProposalResponse(created));
  }),

  respondPickupProposal: asyncHandler(async (req: Request, res: Response) => {
    const updated = await bookingsService.respondPickupProposal({
      actorId: req.authUser!.userId,
      bookingId: req.params.id as string,
      proposalId: req.params.proposalId as string,
      decision: req.body.decision as "ACCEPT" | "DECLINE"
    });
    res.status(200).json(updated ? toBookingPickupProposalResponse(updated) : null);
  }),

  createTimeslotProposal: asyncHandler(async (req: Request, res: Response) => {
    const created = await bookingsService.createTimeslotProposal({
      actorId: req.authUser!.userId,
      bookingId: req.params.id as string,
      startDate: req.body.startDate as string,
      endDate: req.body.endDate as string
    });
    res.status(201).json(toBookingTimeslotProposalResponse(created));
  }),

  respondTimeslotProposal: asyncHandler(async (req: Request, res: Response) => {
    const updated = await bookingsService.respondTimeslotProposal({
      actorId: req.authUser!.userId,
      bookingId: req.params.id as string,
      proposalId: req.params.proposalId as string,
      decision: req.body.decision as "ACCEPT" | "DECLINE"
    });
    res.status(200).json(updated ? toBookingTimeslotProposalResponse(updated) : null);
  })
};