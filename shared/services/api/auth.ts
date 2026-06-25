import type { AuthPayload, RefreshPayload } from "./types";
import { request, requestParsed } from "./client";
import { authResponseSchema, refreshResponseSchema } from "../../contracts/response/auth.schema";

export const authApi = {
  async login(email: string, password: string): Promise<AuthPayload> {
    return requestParsed(authResponseSchema, "/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },

  async register(input: { email: string; password: string; name: string; address: string }): Promise<AuthPayload> {
    return requestParsed(authResponseSchema, "/auth/register", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  async refresh(refreshToken: string): Promise<RefreshPayload> {
    return requestParsed(refreshResponseSchema, "/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken })
    });
  },

  async changePassword(currentPassword: string, newPassword: string, token: string): Promise<void> {
    return request<void>(
      "/auth/change-password",
      { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) },
      token
    );
  }
};
