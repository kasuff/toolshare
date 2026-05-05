import { z } from "zod";

export const suggestAddressSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    q: z.string().trim().min(3).max(200)
  })
});

export const validateAddressSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    q: z.string().trim().min(5).max(200)
  })
});
