import { prisma } from "../../../config/prisma";
import type { SystemSettingKey } from "../services/system-settings.config";

export const systemRulesRepository = {
  async findAllValues(): Promise<Map<string, number>> {
    const rows = await prisma.systemSetting.findMany();
    return new Map(rows.map((row) => [row.key, row.value]));
  },

  upsert(key: SystemSettingKey, value: number) {
    return prisma.systemSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value }
    });
  }
};