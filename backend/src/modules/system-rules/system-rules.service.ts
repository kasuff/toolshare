import { AppError } from "../../utils/app-error";
import { systemRulesRepository } from "./system-rules.repository";
import {
  ENFORCED_SETTING_DEFS,
  SYSTEM_SETTING_DEF_BY_KEY,
  isEnforcedSettingKey,
  type SystemSetting,
  type SystemSettingKey
} from "./system-settings.config";

export const systemRulesService = {
  // Liefert die durchgesetzten Einstellungen mit aufgelöstem Wert
  // (gespeicherter Wert oder Default). Nicht durchgesetzte Regeln werden
  // bewusst nicht ausgeliefert – sie sollen nicht angezeigt/editiert werden.
  async listSettings(): Promise<SystemSetting[]> {
    const stored = await systemRulesRepository.findAllValues();
    return ENFORCED_SETTING_DEFS.map((def) => ({
      ...def,
      value: stored.get(def.key) ?? def.defaultValue
    }));
  },

  // Aufgelöste Werte als Map (key -> value) für die Durchsetzung in der Geschäftslogik.
  async getValues(): Promise<Record<SystemSettingKey, number>> {
    const settings = await this.listSettings();
    return settings.reduce(
      (acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      },
      {} as Record<SystemSettingKey, number>
    );
  },

  async updateSetting(key: string, value: number): Promise<SystemSetting> {
    if (!isEnforcedSettingKey(key)) {
      throw new AppError("SETTING_NOT_FOUND", "System setting not found", 404);
    }
    const def = SYSTEM_SETTING_DEF_BY_KEY[key];
    if (!Number.isInteger(value) || value < def.min || value > def.max) {
      throw new AppError(
        "SETTING_OUT_OF_RANGE",
        `Wert muss zwischen ${def.min} und ${def.max} liegen.`,
        400
      );
    }
    const row = await systemRulesRepository.upsert(key, value);
    return { ...def, value: row.value };
  }
};
