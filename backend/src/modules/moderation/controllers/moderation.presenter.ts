import type { ModerationReportResponse } from "@toolshare/shared/contracts/response/moderation.schema";

export type ReportRowInput = {
  id: string;
  reporterId: string;
  reporter: { id: string; name: string; email?: string };
  targetType: "TOOL" | "WORKSHOP" | "USER" | "RATING";
  targetId: string;
  bookingId?: string | null;
  reason: string;
  details?: string | null;
  conversationContext?: string | null;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED";
  decisionNote?: string | null;
  decisionAt?: Date | string | null;
  moderatorId?: string | null;
  createdAt: Date | string;
};

export type ModerationLookups = {
  tools: Array<{ id: string; name: string; ownerId: string; owner: { id: string; name: string } }>;
  workshops: Array<{
    id: string;
    name: string;
    managerId: string;
    manager: { id: string; name: string };
  }>;
  users: Array<{ id: string; name: string; email?: string }>;
  ratings: Array<{
    id: string;
    score: number;
    comment: string | null;
    fromUserId: string;
    fromUser: { id: string; name: string };
    booking: {
      tool?: { id: string; name: string } | null;
      timeslot?: { workshop?: { id: string; name: string } | null } | null;
    };
  }>;
  moderators: Array<{ id: string; name: string }>;
};

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : String(value);
const isoOrNull = (value: Date | string | null | undefined): string | null =>
  value == null ? null : value instanceof Date ? value.toISOString() : String(value);

export function toModerationReportResponse(
  report: ReportRowInput,
  lookups: ModerationLookups
): ModerationReportResponse {
  let targetLabel = report.targetId;
  let targetHref: string | null = null;
  let subjectUserId: string | null = null;
  let subjectUserName: string | null = null;
  let ratingPreview: ModerationReportResponse["ratingPreview"] = null;

  if (report.targetType === "TOOL") {
    const tool = lookups.tools.find((t) => t.id === report.targetId);
    if (tool) {
      targetLabel = tool.name;
      targetHref = `/tools/${tool.id}`;
      subjectUserId = tool.ownerId;
      subjectUserName = tool.owner.name;
    }
  } else if (report.targetType === "WORKSHOP") {
    const workshop = lookups.workshops.find((w) => w.id === report.targetId);
    if (workshop) {
      targetLabel = workshop.name;
      targetHref = `/workshops?open=${workshop.id}`;
      subjectUserId = workshop.managerId;
      subjectUserName = workshop.manager.name;
    }
  } else if (report.targetType === "RATING") {
    const rating = lookups.ratings.find((entry) => entry.id === report.targetId);
    if (rating) {
      const listingLabel =
        rating.booking.tool?.name ?? rating.booking.timeslot?.workshop?.name ?? null;
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
    const user = lookups.users.find((u) => u.id === report.targetId);
    if (user) {
      targetLabel = user.name;
      subjectUserId = user.id;
      subjectUserName = user.name;
    }
  }

  const moderatorName =
    report.moderatorId != null
      ? (lookups.moderators.find((m) => m.id === report.moderatorId)?.name ?? null)
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
    bookingId: report.bookingId ?? null,
    reason: report.reason,
    details: report.details ?? null,
    conversationContext: report.conversationContext ?? null,
    status: report.status,
    decisionNote: report.decisionNote ?? null,
    decisionAt: isoOrNull(report.decisionAt),
    moderatorId: report.moderatorId ?? null,
    moderatorName,
    createdAt: iso(report.createdAt)
  };
}