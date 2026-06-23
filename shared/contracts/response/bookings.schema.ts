import { z } from "zod";
import { bookingStatusSchema } from "../request/bookings.schema";

export const bookingResponseSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["TOOL", "WORKSHOP", "SYSTEM_WARNING"]),
  status: bookingStatusSchema,
  startDate: z.string(),
  endDate: z.string(),
  toolId: z.string().uuid().nullable().optional(),
  workshopId: z.string().uuid().nullable().optional(),
  borrowerId: z.string().uuid(),
  providerId: z.string().uuid().nullable().optional()
});

export type BookingResponse = z.infer<typeof bookingResponseSchema>;
