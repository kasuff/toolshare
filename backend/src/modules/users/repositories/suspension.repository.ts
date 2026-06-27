import { prisma } from "../../../config/prisma";

export const suspensionRepository = {
  create(input: {
    userId: string;
    requestedById: string;
    reportId?: string;
    reason: string;
  }) {
    return prisma.suspensionRequest.create({
      data: input,
      include: {
        user: { select: { id: true, name: true, email: true } },
        requestedBy: { select: { id: true, name: true } },
        report: { select: { id: true, reason: true } }
      }
    });
  },

  listPending() {
    return prisma.suspensionRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, isSuspended: true } },
        requestedBy: { select: { id: true, name: true } },
        report: { select: { id: true, reason: true, targetType: true, targetId: true } }
      }
    });
  },

  findById(id: string) {
    return prisma.suspensionRequest.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, isSuspended: true } }
      }
    });
  },

  updateDecision(
    id: string,
    input: {
      status: "APPROVED" | "REJECTED";
      adminId: string;
      decisionNote?: string;
    }
  ) {
    return prisma.suspensionRequest.update({
      where: { id },
      data: {
        status: input.status,
        adminId: input.adminId,
        decisionNote: input.decisionNote
      },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    });
  },

  listManagerIds() {
    return prisma.user.findMany({
      where: { role: "MANAGER" },
      select: { id: true }
    });
  }
};