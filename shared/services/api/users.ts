import type { User } from "../../types/domain";
import type { BackendRole, BackendUser } from "./types";
import { request } from "./client";
import { roleMap } from "./mappers/roles";

export const usersApi = {
  async getCurrentUser(token: string): Promise<User> {
    const user = await request<BackendUser>("/users/me", undefined, token);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      address: user.address,
      role: roleMap[user.role],
      isSuspended: user.isSuspended ?? false
    };
  },

  async listUsers(
    token: string,
    filters: { search?: string; role?: "NUTZER" | "MODERATOR" | "ADMIN" } = {}
  ): Promise<User[]> {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.role) {
      params.set("role", filters.role === "ADMIN" ? "MANAGER" : filters.role === "MODERATOR" ? "MODERATOR" : "USER");
    }

    const query = params.toString();
    const users = await request<BackendUser[]>(query ? `/users?${query}` : "/users", undefined, token);
    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: roleMap[user.role],
      isSuspended: user.isSuspended
    }));
  },

  async updateUserRole(userId: string, role: "NUTZER" | "MODERATOR" | "ADMIN", token: string) {
    const backendRole: BackendRole = role === "ADMIN" ? "MANAGER" : role === "MODERATOR" ? "MODERATOR" : "USER";
    await request(
      `/users/${userId}/role`,
      {
        method: "PATCH",
        body: JSON.stringify({ role: backendRole })
      },
      token
    );
  },

  async updateUserSuspension(userId: string, isSuspended: boolean, token: string) {
    await request(
      `/users/${userId}/suspension`,
      {
        method: "PATCH",
        body: JSON.stringify({ isSuspended })
      },
      token
    );
  },

  async updateMyProfile(
    input: { name?: string; address?: string; expoPushToken?: string },
    token: string
  ): Promise<User> {
    const user = await request<BackendUser>(
      "/users/me",
      {
        method: "PATCH",
        body: JSON.stringify(input)
      },
      token
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      address: user.address,
      role: roleMap[user.role],
      isSuspended: user.isSuspended
    };
  }

};
