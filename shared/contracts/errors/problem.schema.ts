import { z } from "zod";

export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  code: z.string().optional(),
  errors: z
    .object({
      fieldErrors: z.record(z.array(z.string())).optional(),
      formErrors: z.array(z.string()).optional()
    })
    .optional()
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
