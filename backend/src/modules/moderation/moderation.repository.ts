import { prisma } from "../../config/prisma";

export const moderationRepository = {
  createReport(input: { reporterId: string; bookingId?: string; reason: string; details?: string }) {
    return prisma.report.create({
      data: {
        reporterId: input.reporterId,
        bookingId: input.bookingId,
        reason: input.reason,
        details: input.details
      }
    });
  },

  listOpenReports() {
    return prisma.report.findMany({
      where: { status: { in: ["OPEN", "IN_REVIEW"] } },
      orderBy: { createdAt: "desc" }
    });
  },

  findById(id: string) {
    return prisma.report.findUnique({ where: { id } });
  },

  updateStatus(id: string, status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED", moderatorId: string) {
    return prisma.report.update({
      where: { id },
      data: { status, moderatorId }
    });
  }
};
