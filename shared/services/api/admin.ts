import type { BackendMetrics, SystemSetting } from "./types";
import { request } from "./client";

export const adminApi = {
  async getMetrics(token: string): Promise<BackendMetrics> {
    return request<BackendMetrics>("/users/admin/metrics", undefined, token);
  },

  async getSystemSettings(token: string): Promise<SystemSetting[]> {
    return request<SystemSetting[]>("/system-rules", undefined, token);
  },

  async updateSystemSetting(key: string, value: number, token: string): Promise<SystemSetting> {
    return request<SystemSetting>(
      `/system-rules/${key}`,
      { method: "PUT", body: JSON.stringify({ value }) },
      token
    );
  }
};
