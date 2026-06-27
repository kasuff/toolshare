import type { SystemSettingResponse } from "@toolshare/shared/contracts/response/system-rules.schema";
import type { SystemSetting } from "../services/system-settings.config";

// Kuratiert die interne Settings-Definition auf den Wire-Vertrag:
// interne Felder wie `defaultValue` und `enforced` werden bewusst nicht ausgeliefert.
export function toSystemSettingResponse(setting: SystemSetting): SystemSettingResponse {
  return {
    key: setting.key,
    label: setting.label,
    unit: setting.unit,
    value: setting.value,
    min: setting.min,
    max: setting.max
  };
}

export function toSystemSettingResponseList(settings: SystemSetting[]): SystemSettingResponse[] {
  return settings.map(toSystemSettingResponse);
}