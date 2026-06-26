import { z } from "zod";
import { toolStatusSchema } from "../request/tools.schema";

export const workshopManagerResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  isSuspended: z.boolean().optional()
});

export const workshopToolResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: z.string(),
  status: toolStatusSchema.optional()
});

export const workshopTimeslotResponseSchema = z.object({
  id: z.string().uuid(),
  workshopId: z.string().uuid(),
  startTime: z.string(),
  endTime: z.string(),
  blockedByOwner: z.boolean()
});

export const workshopBookingRangeResponseSchema = z.object({
  id: z.string().uuid(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "RETURNED"])
});

export const workshopResponseSchema = z.object({
  id: z.string().uuid(),
  managerId: z.string().uuid(),
  manager: workshopManagerResponseSchema.nullable().optional(),
  name: z.string(),
  description: z.string(),
  location: z.string(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  maxCapacity: z.number(),
  extras: z.array(z.string()),
  imageUrls: z.array(z.string()),
  workshopTools: z.array(workshopToolResponseSchema).optional(),
  timeslots: z.array(workshopTimeslotResponseSchema).optional(),
  bookings: z.array(workshopBookingRangeResponseSchema).optional()
});

export const workshopListResponseSchema = z.array(workshopResponseSchema);

export type WorkshopResponse = z.infer<typeof workshopResponseSchema>;
export type WorkshopTimeslotResponse = z.infer<typeof workshopTimeslotResponseSchema>;
