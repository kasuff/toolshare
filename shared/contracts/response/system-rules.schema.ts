import { z } from "zod";

export const systemSettingResponseSchema = z.object({
  key: z.string(),
  label: z.string(),
  unit: z.string(),
  value: z.number(),
  min: z.number(),
  max: z.number()
});

export const systemSettingListResponseSchema = z.array(systemSettingResponseSchema);

export type SystemSettingResponse = z.infer<typeof systemSettingResponseSchema>;
