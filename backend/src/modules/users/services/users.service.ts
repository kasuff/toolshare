import { AppError } from "../../../utils/app-error";
import { addressService } from "../../address/services/address.service";
import { notificationsService } from "../../notifications/services/notifications.service";
import { usersRepository } from "../repositories/users.repository";

export const usersService = {
  async listUsers(filters: { role?: "USER" | "MODERATOR" | "MANAGER"; search?: string }) {
    return await usersRepository.listPublic(filters);
  },

  async getMyProfile(userId: string) {
    const user = await usersRepository.findByIdPublic(userId);
    if (!user) {
      throw new AppError("USER_NOT_FOUND", "User not found", 404);
    }
    return user;
  },

  async getById(userId: string) {
    const user = await usersRepository.findByIdPublic(userId);
    if (!user) {
      throw new AppError("USER_NOT_FOUND", "User not found", 404);
    }
    return user;
  },

  async updateMyProfile(input: { userId: string; name?: string; address?: string; expoPushToken?: string }) {
    const existing = await usersRepository.findByIdPublic(input.userId);
    if (!existing) {
      throw new AppError("USER_NOT_FOUND", "User not found", 404);
    }

    const geo = input.address !== undefined ? await addressService.geocode(input.address) : null;

    const updated = await usersRepository.updateProfile(input.userId, {
      name: input.name,
      address: input.address,
      ...(input.address !== undefined
        ? { latitude: geo?.latitude ?? null, longitude: geo?.longitude ?? null }
        : {}),
      expoPushToken: input.expoPushToken
    });
    return updated;
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
    return updated;
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

    return updated;
  },

  async getAdminMetrics() {
    const metrics = await usersRepository.getSystemMetrics();
    return metrics;
  }
};