import { AppError } from "../../utils/app-error";
import { notificationsService } from "../notifications/notifications.service";
import { usersRepository } from "./users.repository";
import { toAdminMetricsResponse, toUserResponse, toUserResponseList } from "./users.presenter";

export const usersService = {
  async listUsers(filters: { role?: "USER" | "MODERATOR" | "MANAGER"; search?: string }) {
    const users = await usersRepository.listPublic(filters);
    return toUserResponseList(users);
  },

  async getMyProfile(userId: string) {
    const user = await usersRepository.findByIdPublic(userId);
    if (!user) {
      throw new AppError("USER_NOT_FOUND", "User not found", 404);
    }
    return toUserResponse(user);
  },

  async getById(userId: string) {
    const user = await usersRepository.findByIdPublic(userId);
    if (!user) {
      throw new AppError("USER_NOT_FOUND", "User not found", 404);
    }
    return toUserResponse(user);
  },

  async updateMyProfile(input: { userId: string; name?: string; address?: string; expoPushToken?: string }) {
    const existing = await usersRepository.findByIdPublic(input.userId);
    if (!existing) {
      throw new AppError("USER_NOT_FOUND", "User not found", 404);
    }

    const updated = await usersRepository.updateProfile(input.userId, {
      name: input.name,
      address: input.address,
      expoPushToken: input.expoPushToken
    });
    return toUserResponse(updated);
  },

  async updateRole(input: {
    targetUserId: string;
    role: "USER" | "MODERATOR" | "MANAGER";
    actorId: string;
  }) {
    const existing = await usersRepository.findByIdPublic(input.targetUserId);
    if (!existing) {
      throw new AppError("USER_NOT_FOUND", "User not found", 404);
    }

    if (existing.role === "MANAGER" && input.role !== "MANAGER") {
      throw new AppError(
        "INVALID_ROLE_CHANGE",
        "Managers cannot be downgraded through this endpoint",
        400
      );
    }

    const updated = await usersRepository.updateRole(input.targetUserId, input.role);
    return toUserResponse(updated);
  },

  async updateSuspension(input: { targetUserId: string; isSuspended: boolean }) {
    const existing = await usersRepository.findByIdPublic(input.targetUserId);
    if (!existing) {
      throw new AppError("USER_NOT_FOUND", "User not found", 404);
    }

    if (existing.role === "MANAGER") {
      throw new AppError(
        "INVALID_ACCOUNT_SUSPENSION",
        "Managers cannot be suspended through this endpoint",
        400
      );
    }

    const updated = await usersRepository.updateSuspension(input.targetUserId, input.isSuspended);

    if (input.isSuspended && !existing.isSuspended) {
      await notificationsService.createSuspensionNotice(
        input.targetUserId,
        "Dein Konto wurde von der Administration gesperrt."
      );
    }

    return toUserResponse(updated);
  },

  async getAdminMetrics() {
    const metrics = await usersRepository.getSystemMetrics();
    return toAdminMetricsResponse(metrics);
  }
};
