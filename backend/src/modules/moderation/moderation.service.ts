import { AppError } from "../../utils/app-error";
import { notificationsService } from "../notifications/notifications.service";
import { ratingsService } from "../ratings/ratings.service";
import { suspensionRepository } from "../users/suspension.repository";
import { moderationRepository } from "./moderation.repository";

type ReportRow = Awaited<ReturnType<typeof moderationRepository.listOpenReports>>[number];
type RatingRow = Awaited<ReturnType<typeof moderationRepository.findRatingsByIds>>[number];

function enrichReport(
  report: ReportRow,
  tools: Awaited<ReturnType<typeof moderationRepository.findToolsByIds>>,
  workshops: Awaited<ReturnType<typeof moderationRepository.findWorkshopsByIds>>,
  users: Awaited<ReturnType<typeof moderationRepository.findUsersByIds>>,
  ratings: RatingRow[],
  moderators: Awaited<ReturnType<typeof moderationRepository.findUsersByIds>>
) {
  let targetLabel = report.targetId;
  let targetHref: string | null = null;
  let subjectUserId: string | null = null;
  let subjectUserName: string | null = null;
  let ratingPreview: {
    score: number;
    comment: string | null;
    fromUserName: string;
    listingLabel: string | null;
  } | null = null;

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
  } else if (report.targetType === "RATING") {
    const rating = ratings.find((entry) => entry.id === report.targetId);
    if (rating) {
      const listingLabel = rating.booking.tool?.name ?? rating.booking.timeslot?.workshop?.name ?? null;
      targetLabel = `Bewertung (${rating.score} Sterne)`;
      subjectUserId = rating.fromUserId;
      subjectUserName = rating.fromUser.name;
      ratingPreview = {
        score: rating.score,
        comment: rating.comment,
        fromUserName: rating.fromUser.name,
        listingLabel
      };
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
    ratingPreview,
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

  return reports.map((report) => enrichReport(report, tools, workshops, users, ratings, moderators));
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
  }) {
    const report = await moderationRepository.findById(input.reportId);
    if (!report) {
      throw new AppError("REPORT_NOT_FOUND", "Report not found", 404);
    }

    if (report.status === "RESOLVED" || report.status === "REJECTED") {
      throw new AppError("REPORT_ALREADY_CLOSED", "Report is already closed", 409);
    }

    if ((input.warnUserId && !input.warningReason) || (!input.warnUserId && input.warningReason)) {
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

    if (input.status === "REJECTED" && !input.decisionNote?.trim()) {
      throw new AppError("DECISION_NOTE_REQUIRED", "decisionNote is required when rejecting a report", 400);
    }

    if (
      input.status === "RESOLVED" &&
      !input.warnUserId &&
      !input.requestSuspensionUserId &&
      !input.decisionNote?.trim()
    ) {
      throw new AppError(
        "DECISION_NOTE_REQUIRED",
        "decisionNote is required when resolving without warning or suspension request",
        400
      );
    }

    const updated = await moderationRepository.updateStatus(
      input.reportId,
      input.status,
      input.moderatorId,
      input.decisionNote?.trim()
    );

    if (input.status === "RESOLVED" && report.targetType === "RATING") {
      await ratingsService.hideFromModeration(
        report.targetId,
        input.moderatorId,
        input.decisionNote?.trim()
      );
    }

    if (input.warnUserId && input.warningReason) {
      await notificationsService.createWarning(input.warnUserId, input.warningReason);
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
