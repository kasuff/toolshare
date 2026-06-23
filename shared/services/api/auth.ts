import type { AuthPayload } from "./types";
import { request } from "./client";

export const authApi = {
  async login(email: string, password: string): Promise<AuthPayload> {
    return request<AuthPayload>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },

  async register(input: { email: string; password: string; name: string; address: string }) {
    return request<AuthPayload>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  async changePassword(currentPassword: string, newPassword: string, token: string): Promise<void> {
    return request<void>(
      "/auth/change-password",
      { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) },
      token
    );
  },

};
