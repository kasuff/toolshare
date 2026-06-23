import { z } from "zod";
import { roleResponseSchema } from "./users.schema";

export const authUserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  address: z.string().optional(),
  role: roleResponseSchema,
  isSuspended: z.boolean().optional()
});

export const authResponseSchema = z.object({
  user: authUserResponseSchema,
  accessToken: z.string(),
  refreshToken: z.string()
});

export const refreshResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string()
});

export type AuthUserResponse = z.infer<typeof authUserResponseSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
