import type { BackendMetrics, SystemSetting } from "./types";
import { requestParsed } from "./client";
import { adminMetricsResponseSchema } from "../../contracts/response/users.schema";
import {
  systemSettingResponseSchema,
  systemSettingListResponseSchema
} from "../../contracts/response/system-rules.schema";

export const adminApi = {
  async getMetrics(token: string): Promise<BackendMetrics> {
    return requestParsed(adminMetricsResponseSchema, "/users/admin/metrics", undefined, token);
  },

  async getSystemSettings(token: string): Promise<SystemSetting[]> {
    return requestParsed(systemSettingListResponseSchema, "/system-rules", undefined, token);
  },

  async updateSystemSetting(key: string, value: number, token: string): Promise<SystemSetting> {
    return requestParsed(
      systemSettingResponseSchema,
      `/system-rules/${key}`,
      { method: "PUT", body: JSON.stringify({ value }) },
      token
    );
  }
};
