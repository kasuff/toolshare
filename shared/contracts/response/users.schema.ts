import { z } from "zod";

export const roleResponseSchema = z.enum(["USER", "MODERATOR", "MANAGER"]);

export const userResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  address: z.string(),
  role: roleResponseSchema,
  isSuspended: z.boolean(),
  expoPushToken: z.string().nullable().optional(),
  createdAt: z.string().optional()
});

export const userListResponseSchema = z.array(userResponseSchema);

export const adminMetricsResponseSchema = z.object({
  users: z.number(),
  tools: z.number(),
  workshops: z.number(),
  openBookings: z.number(),
  openReports: z.number(),
  openSuspensionRequests: z.number()
});

export type UserResponse = z.infer<typeof userResponseSchema>;
export type AdminMetricsResponse = z.infer<typeof adminMetricsResponseSchema>;
