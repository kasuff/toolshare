import { AppError } from "../../utils/app-error";
import { enqueueBookingCancellationNotification } from "../../infrastructure/outbox/enqueue-user-notification";
import { notificationsService } from "../notifications/notifications.service";
import { ratingsService } from "../ratings/ratings.service";
import { suspensionRepository } from "../users/suspension.repository";
import { moderationRepository } from "./moderation.repository";
import { toolsService } from "../tools/tools.service";
import { workshopsService } from "../workshops/workshops.service";
import { toModerationReportResponse } from "./moderation.presenter";

type ReportRow = Awaited<ReturnType<typeof moderationRepository.listOpenReports>>[number];

async function enrichReports(reports: ReportRow[]) {
  const toolIds = reports.filter((r) => r.targetType === "TOOL").map((r) => r.targetId);
  const workshopIds = reports.filter((r) => r.targetType === "WORKSHOP").map((r) => r.targetId);
  const userIds = reports.filter((r) => r.targetType === "USER").map((r) => r.targetId);
  const ratingIds = reports.filter((r) => r.targetType === "RATING").map((r) => r.targetId);
  const moderatorIds = [
    ...new Set(reports.map((r) => r.moderatorId).filter((id): id is string => Boolean(id)))
  ];

  const [tools, workshops, users, ratings, moderators] = await Promise.all([
    moderationRepository.findToolsByIds(toolIds),
    moderationRepository.findWorkshopsByIds(workshopIds),
    moderationRepository.findUsersByIds(userIds),
    moderationRepository.findRatingsByIds(ratingIds),
    moderationRepository.findUsersByIds(moderatorIds)
  ]);

  return reports.map((report) =>
    toModerationReportResponse(report, { tools, workshops, users, ratings, moderators })
  );
}

export const moderationService = {
  createReport(input: {
    reporterId: string;
    targetType: "TOOL" | "WORKSHOP" | "USER" | "RATING";
    targetId: string;
    bookingId?: string;
    reason: string;
    details?: string;
    conversationContext?: string;
  }) {
    return moderationRepository.createReport(input);
  },

  listReports() {
    return moderationRepository.listOpenReports().then(enrichReports);
  },

  listClosedReports() {
    return moderationRepository.listClosedReports().then(enrichReports);
  },

  async updateReportStatus(input: {
    reportId: string;
    status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED";
    moderatorId: string;
    decisionNote?: string;
    warnUserId?: string;
    warningReason?: string;
    requestSuspensionUserId?: string;
    suspensionReason?: string;
    deleteTool?: boolean;
    deleteWorkshop?: boolean;
    deleteRating?: boolean;
  }) {
    const report = await moderationRepository.findById(input.reportId);
    if (!report) {
      throw new AppError("REPORT_NOT_FOUND", "Report not found", 404);
    }

    if (report.status === "RESOLVED" || report.status === "REJECTED") {
      throw new AppError("REPORT_ALREADY_CLOSED", "Report is already closed", 409);
    }

    if (
      (input.warnUserId && !input.warningReason) ||
      (!input.warnUserId && input.warningReason && !input.deleteTool && !input.deleteWorkshop && !input.deleteRating)
    ) {
      throw new AppError(
        "INVALID_WARNING_INPUT",
        "warnUserId and warningReason must be provided together",
        400
      );
    }

    if (
      (input.requestSuspensionUserId && !input.suspensionReason) ||
      (!input.requestSuspensionUserId && input.suspensionReason)
    ) {
      throw new AppError(
        "INVALID_SUSPENSION_INPUT",
        "requestSuspensionUserId and suspensionReason must be provided together",
        400
      );
    }

    if (input.deleteTool) {
      if (report.targetType !== "TOOL") {
        throw new AppError("INVALID_TARGET_TYPE", "Cannot delete tool: report target is not a tool", 400);
      }
      if (!input.warningReason?.trim()) {
        throw new AppError("WARNING_REASON_REQUIRED", "warningReason is required when deleting a tool", 400);
      }
    }

    if (input.deleteWorkshop) {
      if (report.targetType !== "WORKSHOP") {
        throw new AppError("INVALID_TARGET_TYPE", "Cannot delete workshop: report target is not a workshop", 400);
      }
      if (!input.warningReason?.trim()) {
        throw new AppError("WARNING_REASON_REQUIRED", "warningReason is required when deleting a workshop", 400);
      }
    }

    if (input.deleteRating) {
      if (report.targetType !== "RATING") {
        throw new AppError("INVALID_TARGET_TYPE", "Cannot delete rating: report target is not a rating", 400);
      }
    }

    if (input.status === "REJECTED" && !input.decisionNote?.trim()) {
      throw new AppError("DECISION_NOTE_REQUIRED", "decisionNote is required when rejecting a report", 400);
    }

    if (
      input.status === "RESOLVED" &&
      !input.warnUserId &&
      !input.requestSuspensionUserId &&
      !input.deleteTool &&
      !input.deleteWorkshop &&
      !input.deleteRating &&
      !input.decisionNote?.trim()
    ) {
      throw new AppError(
        "DECISION_NOTE_REQUIRED",
        "decisionNote is required when resolving without warning, suspension request, or deletion",
        400
      );
    }

    let targetOwnerId: string | null = null;
    let customWarningMsg: string | null = null;

    if (input.deleteTool) {
      const tool = await toolsService.getById(report.targetId);
      targetOwnerId = tool.ownerId;
      customWarningMsg = `Dein Angebot "${tool.name}" wurde gelöscht. Grund: ${input.warningReason}`;

      // Cancel and notify active bookings first
      const activeToolBookings = await moderationRepository.findActiveToolBookings(report.targetId);
      for (const booking of activeToolBookings) {
        await moderationRepository.rejectBooking(booking.id);
        await enqueueBookingCancellationNotification({
          bookingId: booking.id,
          userId: booking.userId,
          inAppMessage: `Deine Buchung für das Werkzeug "${tool.name}" wurde storniert, da das Angebot gelöscht wurde.`
        });
      }

      await toolsService.remove({
        toolId: report.targetId,
        actorId: input.moderatorId,
        actorRole: "MODERATOR",
      });
    }

    if (input.deleteWorkshop) {
      const workshop = await workshopsService.getById(report.targetId);
      targetOwnerId = workshop.managerId;
      customWarningMsg = `Deine Werkstatt "${workshop.name}" wurde gelöscht. Grund: ${input.warningReason}`;

      // Cancel and notify active bookings first
      const activeWorkshopBookings = await moderationRepository.findActiveWorkshopBookings(
        report.targetId
      );
      for (const booking of activeWorkshopBookings) {
        await moderationRepository.rejectBooking(booking.id);
        await enqueueBookingCancellationNotification({
          bookingId: booking.id,
          userId: booking.userId,
          inAppMessage: `Deine Buchung für die Werkstatt "${workshop.name}" wurde storniert, da die Werkstatt gelöscht wurde.`
        });
      }

      await workshopsService.remove({
        workshopId: report.targetId,
        managerId: targetOwnerId,
        actorRole: "MODERATOR",
      });
    }

    const updated = await moderationRepository.updateStatus(
      input.reportId,
      input.status,
      input.moderatorId,
      input.decisionNote?.trim()
    );

    if (input.status === "RESOLVED" && report.targetType === "RATING") {
      if (input.deleteRating) {
        await ratingsService.removeFromModeration(report.targetId);
      } else {
        await ratingsService.hideFromModeration(
          report.targetId,
          input.moderatorId,
          input.decisionNote?.trim()
        );
      }
    }

    if (input.warnUserId && input.warningReason) {
      const moderators = await moderationRepository.findUsersByIds([input.moderatorId]);
      const moderatorName = (moderators && moderators[0]?.name) || "Moderator";
      await notificationsService.createWarning(input.warnUserId, input.warningReason, moderatorName);
    }

    if (customWarningMsg && targetOwnerId) {
      const moderators = await moderationRepository.findUsersByIds([input.moderatorId]);
      const moderatorName = (moderators && moderators[0]?.name) || "Moderator";
      await notificationsService.createWarning(targetOwnerId, customWarningMsg, moderatorName);
    }

    if (input.requestSuspensionUserId && input.suspensionReason) {
      const request = await suspensionRepository.create({
        userId: input.requestSuspensionUserId,
        requestedById: input.moderatorId,
        reportId: input.reportId,
        reason: input.suspensionReason.trim()
      });
      await notificationsService.notifyManagersSuspensionRequest(
        request.id,
        request.user.name,
        input.suspensionReason.trim()
      );
    }

    return updated;
  }
};
