import { z } from "zod";
import { bookingStatusSchema } from "../request/bookings.schema";

export const bookingProposalStatusSchema = z.enum(["PENDING", "ACCEPTED", "DECLINED"]);

const userRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string()
});

export const bookingPickupProposalResponseSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  proposedByUserId: z.string().uuid(),
  proposedPickupTime: z.string(),
  proposedReturnTime: z.string().nullable(),
  previousPickupTime: z.string().nullable(),
  previousReturnTime: z.string().nullable(),
  status: bookingProposalStatusSchema,
  createdAt: z.string()
});

export const bookingTimeslotProposalResponseSchema = z.object({
  id: z.string().uuid(),
  bookingId: z.string().uuid(),
  proposedByUserId: z.string().uuid(),
  proposedStartDate: z.string(),
  proposedEndDate: z.string(),
  previousStartDate: z.string().nullable(),
  previousEndDate: z.string().nullable(),
  status: bookingProposalStatusSchema,
  createdAt: z.string()
});

const bookingToolRefSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  name: z.string(),
  imageUrl: z.string().nullable().optional(),
  owner: userRefSchema.nullable().optional()
});

const bookingWorkshopRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  managerId: z.string().uuid(),
  manager: userRefSchema.nullable().optional()
});

const bookingTimeslotRefSchema = z.object({
  id: z.string().uuid(),
  workshopId: z.string().uuid(),
  startTime: z.string(),
  endTime: z.string(),
  workshop: bookingWorkshopRefSchema.nullable().optional()
});

const bookingSelectedToolResponseSchema = z.object({
  workshopToolId: z.string().uuid(),
  workshopTool: z.object({
    id: z.string().uuid(),
    name: z.string(),
    category: z.string()
  })
});

export const bookingResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  toolId: z.string().uuid().nullable().optional(),
  timeslotId: z.string().uuid().nullable().optional(),
  workshopId: z.string().uuid().nullable().optional(),
  startDate: z.string(),
  endDate: z.string(),
  pickupTime: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  status: bookingStatusSchema,
  user: userRefSchema.nullable().optional(),
  tool: bookingToolRefSchema.nullable().optional(),
  workshop: bookingWorkshopRefSchema.nullable().optional(),
  timeslot: bookingTimeslotRefSchema.nullable().optional(),
  selectedTools: z.array(bookingSelectedToolResponseSchema).optional(),
  pickupProposals: z.array(bookingPickupProposalResponseSchema).optional(),
  timeslotProposals: z.array(bookingTimeslotProposalResponseSchema).optional()
});

export const bookingListResponseSchema = z.array(bookingResponseSchema);

export type BookingResponse = z.infer<typeof bookingResponseSchema>;
export type BookingPickupProposalResponse = z.infer<typeof bookingPickupProposalResponseSchema>;
export type BookingTimeslotProposalResponse = z.infer<typeof bookingTimeslotProposalResponseSchema>;
