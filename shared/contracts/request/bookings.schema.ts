import { z } from "zod";
import { flexibleIsoDateTime } from "./datetime.schema";

export const bookingStatusSchema = z.enum(["PENDING", "ACCEPTED", "REJECTED", "RETURNED"]);

export const createToolBookingBodySchema = z.object({
  toolId: z.string().uuid(),
  startDate: flexibleIsoDateTime,
  endDate: flexibleIsoDateTime,
  pickupTime: flexibleIsoDateTime
});

export const createToolOwnerBlockBodySchema = z.object({
  toolId: z.string().uuid(),
  startDate: flexibleIsoDateTime,
  endDate: flexibleIsoDateTime
});

export const createWorkshopBookingBodySchema = z.object({
  workshopId: z.string().uuid(),
  startDate: flexibleIsoDateTime,
  endDate: flexibleIsoDateTime,
  workshopToolIds: z.array(z.string().uuid()).optional().default([])
});

export const updateBookingStatusBodySchema = z.object({
  status: z.enum(["ACCEPTED", "REJECTED", "RETURNED"])
});

export const createPickupProposalBodySchema = z.object({
  pickupTime: flexibleIsoDateTime,
  returnTime: flexibleIsoDateTime
});

export const respondPickupProposalBodySchema = z.object({
  decision: z.enum(["ACCEPT", "DECLINE"])
});

export const createTimeslotProposalBodySchema = z.object({
  startDate: flexibleIsoDateTime,
  endDate: flexibleIsoDateTime
});

export const respondTimeslotProposalBodySchema = z.object({
  decision: z.enum(["ACCEPT", "DECLINE"])
});

export type CreateToolBookingBody = z.infer<typeof createToolBookingBodySchema>;
export type CreateToolOwnerBlockBody = z.infer<typeof createToolOwnerBlockBodySchema>;
export type CreateWorkshopBookingBody = z.infer<typeof createWorkshopBookingBodySchema>;
export type UpdateBookingStatusBody = z.infer<typeof updateBookingStatusBodySchema>;
export type CreatePickupProposalBody = z.infer<typeof createPickupProposalBodySchema>;
export type RespondPickupProposalBody = z.infer<typeof respondPickupProposalBodySchema>;
export type CreateTimeslotProposalBody = z.infer<typeof createTimeslotProposalBodySchema>;
export type RespondTimeslotProposalBody = z.infer<typeof respondTimeslotProposalBodySchema>;
