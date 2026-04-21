import { z } from "zod";

export const createToolBookingSchema = z.object({
  body: z.object({
    toolId: z.string().uuid(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    pickupTime: z.string().datetime()
  }),
  params: z.object({}),
  query: z.object({})
});

export const createWorkshopBookingSchema = z.object({
  body: z.object({
    timeslotId: z.string().uuid()
  }),
  params: z.object({}),
  query: z.object({})
});

export const updateBookingStatusSchema = z.object({
  body: z.object({
    status: z.enum(["ACCEPTED", "REJECTED", "RETURNED"])
  }),
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});
