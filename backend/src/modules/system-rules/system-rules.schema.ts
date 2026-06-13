import { z } from "zod";
import { SYSTEM_SETTING_KEYS } from "./system-settings.config";

export const updateSystemSettingSchema = z.object({
  body: z.object({
    value: z.number().int()
  }),
  params: z.object({
    key: z.enum(SYSTEM_SETTING_KEYS as [string, ...string[]])
  }),
  query: z.object({})
});
