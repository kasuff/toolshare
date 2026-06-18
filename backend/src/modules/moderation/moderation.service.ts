import { AppError } from "../../utils/app-error";
import { notificationsService } from "../notifications/notifications.service";
import { suspensionRepository } from "../users/suspension.repository";
import { moderationRepository } from "./moderation.repository";
import { toolsService } from "../tools/tools.service";
import { workshopsService } from "../workshops/workshops.service";
import { prisma } from "../../config/prisma";
import { notificationsRepository } from "../notifications/notifications.repository";

type ReportRow = Awaited<ReturnType<typeof moderationRepository.listOpenReports>>[number];

function enrichReport(
  report: ReportRow,
  tools: Awaited<ReturnType<typeof moderationRepository.findToolsByIds>>,
  workshops: Awaited<ReturnType<typeof moderationRepository.findWorkshopsByIds>>,
  users: Awaited<ReturnType<typeof moderationRepository.findUsersByIds>>,
  moderators: Awaited<ReturnType<typeof moderationRepository.findUsersByIds>>
) {
  let targetLabel = report.targetId;
  let targetHref: string | null = null;
  let subjectUserId: string | null = null;
  let subjectUserName: string | null = null;

  if (report.targetType === "TOOL") {
    const tool = tools.find((t) => t.id === report.targetId);
    if (tool) {
      targetLabel = tool.name;
      targetHref = `/tools/${tool.id}`;
      subjectUserId = tool.ownerId;
      subjectUserName = tool.owner.name;
    }
  } else if (report.targetType === "WORKSHOP") {
    const workshop = workshops.find((w) => w.id === report.targetId);
    if (workshop) {
      targetLabel = workshop.name;
      targetHref = `/workshops?open=${workshop.id}`;
      subjectUserId = workshop.managerId;
      subjectUserName = workshop.manager.name;
    }
  } else {
    const user = users.find((u) => u.id === report.targetId);
    if (user) {
      targetLabel = user.name;
      subjectUserId = user.id;
      subjectUserName = user.name;
    }
  }

  const moderatorName =
    report.moderatorId != null
      ? (moderators.find((m) => m.id === report.moderatorId)?.name ?? null)
      : null;

  return {
    id: report.id,
    reporterId: report.reporterId,
    reporterName: report.reporter.name,
    targetType: report.targetType,
    targetId: report.targetId,
    targetLabel,
    targetHref,
    subjectUserId,
    subjectUserName,
    bookingId: report.bookingId,
    reason: report.reason,
    details: report.details,
    conversationContext: report.conversationContext,
    status: report.status,
    decisionNote: report.decisionNote,
    decisionAt: report.decisionAt,
    moderatorId: report.moderatorId,
    moderatorName,
    createdAt: report.createdAt
  };
}

async function enrichReports(reports: ReportRow[]) {
  const toolIds = reports.filter((r) => r.targetType === "TOOL").map((r) => r.targetId);
  const workshopIds = reports.filter((r) => r.targetType === "WORKSHOP").map((r) => r.targetId);
  const userIds = reports.filter((r) => r.targetType === "USER").map((r) => r.targetId);
  const moderatorIds = [
    ...new Set(reports.map((r) => r.moderatorId).filter((id): id is string => Boolean(id)))
  ];

  const [tools, workshops, users, moderators] = await Promise.all([
    moderationRepository.findToolsByIds(toolIds),
    moderationRepository.findWorkshopsByIds(workshopIds),
    moderationRepository.findUsersByIds(userIds),
    moderationRepository.findUsersByIds(moderatorIds)
  ]);

  return reports.map((report) => enrichReport(report, tools, workshops, users, moderators));
}

export const moderationService = {
  createReport(input: {
    reporterId: string;
    targetType: "TOOL" | "WORKSHOP" | "USER";
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
  }) {
    const report = await moderationRepository.findById(input.reportId);
    if (!report) {
      throw new AppError("REPORT_NOT_FOUND", "Report not found", 404);
    }

    if (report.status === "RESOLVED" || report.status === "REJECTED") {
      throw new AppError("REPORT_ALREADY_CLOSED", "Report is already closed", 409);
    }

    if ((input.warnUserId && !input.warningReason) || (!input.warnUserId && input.warningReason && !input.deleteTool && !input.deleteWorkshop)) {
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

    if (input.status === "REJECTED" && !input.decisionNote?.trim()) {
      throw new AppError("DECISION_NOTE_REQUIRED", "decisionNote is required when rejecting a report", 400);
    }

    if (
      input.status === "RESOLVED" &&
      !input.warnUserId &&
      !input.requestSuspensionUserId &&
      !input.deleteTool &&
      !input.deleteWorkshop &&
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
      const activeToolBookings = await prisma.booking.findMany({
        where: {
          toolId: report.targetId,
          status: { in: ["PENDING", "ACCEPTED"] }
        }
      });
      for (const booking of activeToolBookings) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: "REJECTED" }
        });
        await notificationsRepository.create(
          booking.userId,
          `Deine Buchung für das Werkzeug "${tool.name}" wurde storniert, da das Angebot gelöscht wurde.`
        );
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
      const activeWorkshopBookings = await prisma.booking.findMany({
        where: {
          timeslot: {
            workshopId: report.targetId
          },
          status: { in: ["PENDING", "ACCEPTED"] }
        }
      });
      for (const booking of activeWorkshopBookings) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: "REJECTED" }
        });
        await notificationsRepository.create(
          booking.userId,
          `Deine Buchung für die Werkstatt "${workshop.name}" wurde storniert, da die Werkstatt gelöscht wurde.`
        );
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
