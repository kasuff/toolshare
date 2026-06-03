import { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";

/** Buchungen in diesen Statusen blockieren Werkzeug-Zeiträume bzw. Werkstatt-Slots. */
const BLOCKING_BOOKING_STATUSES: BookingStatus[] = ["PENDING", "ACCEPTED"];

export const bookingsRepository = {
  listForUserContext(userId: string) {
    return prisma.booking.findMany({
      where: {
        OR: [{ userId }, { tool: { ownerId: userId } }, { timeslot: { workshop: { managerId: userId } } }]
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

  createToolBookingTransaction(input: {
    userId: string;
    toolId: string;
    startDate: Date;
    endDate: Date;
    pickupTime: Date;
  }) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const tool = await tx.tool.findUnique({ where: { id: input.toolId } });
      if (!tool) {
        return null;
      }

      const overlap = await tx.booking.findFirst({
        where: {
          toolId: input.toolId,
          status: { in: BLOCKING_BOOKING_STATUSES },
          startDate: { lt: input.endDate },
          endDate: { gt: input.startDate }
        }
      });

      if (overlap) {
        return "CONFLICT" as const;
      }

      const booking = await tx.booking.create({
        data: {
          userId: input.userId,
          toolId: input.toolId,
          startDate: input.startDate,
          endDate: input.endDate,
          pickupTime: input.pickupTime,
          status: "PENDING"
        }
      });

      return { booking, tool };
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
          status: { in: BLOCKING_BOOKING_STATUSES }
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
  },

  markToolAvailable(toolId: string) {
    return prisma.tool.update({
      where: { id: toolId },
      data: { status: "AVAILABLE" }
    });
  }
};
