import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";

export const bookingsRepository = {
  listForUserContext(userId: string) {
    return prisma.booking.findMany({
      where: {
        OR: [{ userId }, { tool: { ownerId: userId } }]
      },
      include: {
        user: true,
        tool: { include: { owner: true } },
        timeslot: { include: { workshop: { include: { manager: true } } } },
        pickupProposals: {
          orderBy: { createdAt: "asc" },
          include: { proposedBy: { select: { id: true, name: true } } }
        }
      },
      orderBy: { startDate: "desc" }
    });
  },

  findToolById(toolId: string) {
    return prisma.tool.findUnique({ where: { id: toolId } });
  },

  findBookingById(id: string) {
    return prisma.booking.findUnique({
      where: { id },
      include: {
        tool: true,
        timeslot: { include: { workshop: true } }
      }
    });
  },

  findBookingForPickupProposal(bookingId: string) {
    return prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        tool: true,
        timeslot: { include: { workshop: true } },
        pickupProposals: {
          orderBy: { createdAt: "asc" },
          include: { proposedBy: { select: { id: true, name: true } } }
        }
      }
    });
  },

  declinePendingPickupProposals(tx: Prisma.TransactionClient, bookingId: string) {
    return tx.bookingPickupProposal.updateMany({
      where: { bookingId, status: "PENDING" },
      data: { status: "DECLINED" }
    });
  },

  createPickupProposal(
    tx: Prisma.TransactionClient,
    input: {
      bookingId: string;
      proposedByUserId: string;
      proposedPickupTime: Date;
      previousPickupTime: Date | null;
    }
  ) {
    return tx.bookingPickupProposal.create({
      data: {
        bookingId: input.bookingId,
        proposedByUserId: input.proposedByUserId,
        proposedPickupTime: input.proposedPickupTime,
        previousPickupTime: input.previousPickupTime,
        status: "PENDING"
      },
      include: { proposedBy: { select: { id: true, name: true } } }
    });
  },

  findOverlappingToolBooking(toolId: string, startDate: Date, endDate: Date) {
    return prisma.booking.findFirst({
      where: {
        toolId,
        status: { in: ["PENDING", "ACCEPTED"] },
        startDate: { lt: endDate },
        endDate: { gt: startDate }
      }
    });
  },

  createToolBooking(input: {
    userId: string;
    toolId: string;
    startDate: Date;
    endDate: Date;
    pickupTime: Date;
  }) {
    return prisma.booking.create({
      data: {
        userId: input.userId,
        toolId: input.toolId,
        startDate: input.startDate,
        endDate: input.endDate,
        pickupTime: input.pickupTime,
        status: "PENDING"
      }
    });
  },

  createWorkshopBookingTransaction(input: { userId: string; timeslotId: string }) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const slot = await tx.timeSlot.findUnique({
        where: { id: input.timeslotId }
      });

      if (!slot) {
        return null;
      }

      if (slot.blockedByOwner) {
        return "BLOCKED" as const;
      }

      const overlappingBlockedSlot = await tx.timeSlot.findFirst({
        where: {
          workshopId: slot.workshopId,
          blockedByOwner: true,
          id: { not: slot.id },
          startTime: { lt: slot.endTime },
          endTime: { gt: slot.startTime }
        }
      });
      if (overlappingBlockedSlot) {
        return "BLOCKED" as const;
      }

      const existing = await tx.booking.findFirst({
        where: {
          timeslotId: input.timeslotId,
          status: { in: ["PENDING", "ACCEPTED"] }
        }
      });

      if (existing) {
        return "CONFLICT" as const;
      }

      const booking = await tx.booking.create({
        data: {
          userId: input.userId,
          timeslotId: input.timeslotId,
          startDate: slot.startTime,
          endDate: slot.endTime,
          status: "PENDING"
        }
      });

      return booking;
    });
  },

  updateStatus(id: string, status: "PENDING" | "ACCEPTED" | "REJECTED" | "RETURNED") {
    return prisma.booking.update({
      where: { id },
      data: { status }
    });
  }
};
