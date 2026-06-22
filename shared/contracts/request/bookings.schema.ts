import { z } from "zod";

export const bookingStatusSchema = z.enum(["PENDING", "ACCEPTED", "REJECTED", "RETURNED"]);

export const createToolBookingBodySchema = z.object({
  toolId: z.string().uuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  pickupTime: z.string().datetime()
});

export const createWorkshopBookingBodySchema = z.object({
  workshopId: z.string().uuid(),
  startDate: z.string(),
  endDate: z.string(),
  workshopToolIds: z.array(z.string().uuid()).optional().default([])
});

export type CreateToolBookingBody = z.infer<typeof createToolBookingBodySchema>;
export type CreateWorkshopBookingBody = z.infer<typeof createWorkshopBookingBodySchema>;
