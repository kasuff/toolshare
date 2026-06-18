import { prisma } from "../../config/prisma";

const reportWithReporterInclude = {
  reporter: { select: { id: true, name: true, email: true } }
} as const;

export const moderationRepository = {
  createReport(input: {
    reporterId: string;
    targetType: "TOOL" | "WORKSHOP" | "USER" | "RATING";
    targetId: string;
    bookingId?: string;
    reason: string;
    details?: string;
    conversationContext?: string;
  }) {
    return prisma.report.create({
      data: {
        reporterId: input.reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        bookingId: input.bookingId,
        reason: input.reason,
        details: input.details,
        conversationContext: input.conversationContext
      }
    });
  },

  listOpenReports() {
    return prisma.report.findMany({
      where: { status: { in: ["OPEN", "IN_REVIEW"] } },
      orderBy: { createdAt: "desc" },
      include: reportWithReporterInclude
    });
  },

  listClosedReports() {
    return prisma.report.findMany({
      where: { status: { in: ["RESOLVED", "REJECTED"] } },
      orderBy: { decisionAt: "desc" },
      include: reportWithReporterInclude
    });
  },

  findToolsByIds(ids: string[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return prisma.tool.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, ownerId: true, owner: { select: { id: true, name: true } } }
    });
  },

  findWorkshopsByIds(ids: string[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return prisma.workshop.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, managerId: true, manager: { select: { id: true, name: true } } }
    });
  },

  findUsersByIds(ids: string[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true }
    });
  },

  findRatingsByIds(ids: string[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return prisma.rating.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        score: true,
        comment: true,
        status: true,
        fromUserId: true,
        toUserId: true,
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
        booking: {
          select: {
            tool: { select: { id: true, name: true } },
            timeslot: { select: { workshop: { select: { id: true, name: true } } } }
          }
        }
      }
    });
  },

  findById(id: string) {
    return prisma.report.findUnique({ where: { id } });
  },

  updateStatus(
    id: string,
    status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED",
    moderatorId: string,
    decisionNote?: string
  ) {
    return prisma.report.update({
      where: { id },
      data: {
        status,
        moderatorId,
        decisionNote,
        decisionAt: status === "RESOLVED" || status === "REJECTED" ? new Date() : null
      }
    });
  }
};
