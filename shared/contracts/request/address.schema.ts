import { z } from "zod";

export const suggestAddressQuerySchema = z.object({
  q: z.string().trim().min(3).max(200)
});

export const validateAddressQuerySchema = z.object({
  q: z.string().trim().min(5).max(200)
});

export type SuggestAddressQuery = z.infer<typeof suggestAddressQuerySchema>;
export type ValidateAddressQuery = z.infer<typeof validateAddressQuerySchema>;
