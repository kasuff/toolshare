import { z } from "zod";

export const updateSystemSettingBodySchema = z.object({
  value: z.number().int()
});

export type UpdateSystemSettingBody = z.infer<typeof updateSystemSettingBodySchema>;
