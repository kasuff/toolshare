import { z } from "zod";
import { updateSystemSettingBodySchema } from "@toolshare/shared/contracts/request/system-rules.schema";
import { SYSTEM_SETTING_KEYS } from "../services/system-settings.config";

export const updateSystemSettingSchema = z.object({
  body: updateSystemSettingBodySchema,
  params: z.object({
    key: z.enum(SYSTEM_SETTING_KEYS as [string, ...string[]])
  }),
  query: z.object({})
});