import { z } from "zod";
import { toolStatusSchema } from "../request/tools.schema";

export const toolOwnerResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  role: z.enum(["USER", "MODERATOR", "MANAGER"]),
  isSuspended: z.boolean()
});

export const toolBookingRangeResponseSchema = z.object({
  id: z.string().uuid(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "RETURNED"])
});

export const toolResponseSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  imageUrl: z.string().nullable(),
  pickupLocation: z.string().nullable(),
  pickupLocationNote: z.string().nullable(),
  status: toolStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  owner: toolOwnerResponseSchema,
  bookings: z.array(toolBookingRangeResponseSchema).optional()
});

export const toolListResponseSchema = z.array(toolResponseSchema);

export type ToolResponse = z.infer<typeof toolResponseSchema>;
