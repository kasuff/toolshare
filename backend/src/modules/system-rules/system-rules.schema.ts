import { z } from "zod";

export const createSystemRuleSchema = z.object({
  body: z.object({
    text: z.string().min(1)
  }),
  params: z.object({}),
  query: z.object({})
});

export const updateSystemRuleSchema = z.object({
  body: z.object({
    text: z.string().min(1)
  }),
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});

export const systemRuleIdParamSchema = z.object({
  body: z.object({}),
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({})
});
