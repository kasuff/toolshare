import { z } from "zod";

export const notificationResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  message: z.string(),
  read: z.boolean(),
  createdAt: z.string()
});

export const notificationListResponseSchema = z.array(notificationResponseSchema);

export type NotificationResponse = z.infer<typeof notificationResponseSchema>;
