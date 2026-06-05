import { AppError } from "../../utils/app-error";
import { notificationsService } from "../notifications/notifications.service";
import { usersRepository } from "./users.repository";
import { suspensionRepository } from "./suspension.repository";

export const suspensionService = {
  listPending() {
    return suspensionRepository.listPending();
  },

  async decide(input: {
    requestId: string;
    adminId: string;
    approve: boolean;
    decisionNote?: string;
  }) {
    const existing = await suspensionRepository.findById(input.requestId);
    if (!existing) {
      throw new AppError("SUSPENSION_REQUEST_NOT_FOUND", "Suspension request not found", 404);
    }

    if (existing.status !== "PENDING") {
      throw new AppError("SUSPENSION_REQUEST_ALREADY_DECIDED", "Suspension request is already decided", 409);
    }

    const status = input.approve ? "APPROVED" : "REJECTED";
    const updated = await suspensionRepository.updateDecision(input.requestId, {
      status,
      adminId: input.adminId,
      decisionNote: input.decisionNote?.trim()
    });

    if (input.approve) {
      await usersRepository.updateSuspension(existing.userId, true);
      await notificationsService.createSuspensionNotice(
        existing.userId,
        existing.reason
      );
    }

    return updated;
  }
};
