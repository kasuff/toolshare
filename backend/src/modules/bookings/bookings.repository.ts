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
        selectedTools: { include: { workshopTool: true } },
        pickupProposals: {
          orderBy: { createdAt: "asc" },
          include: { proposedBy: { select: { id: true, name: true } } }
        },
        timeslotProposals: {
          orderBy: { createdAt: "asc" },
          include: {
            proposedBy: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
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
        timeslot: { include: { workshop: true } },
        selectedTools: { include: { workshopTool: true } }
      }
    });
  },

  findBookingForPickupProposal(bookingId: string) {
    return prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        tool: true,
        timeslot: { include: { workshop: true } },
        selectedTools: { include: { workshopTool: true } },
        pickupProposals: {
          orderBy: { createdAt: "asc" },
          include: { proposedBy: { select: { id: true, name: true } } }
        }
      }
    });
  },

  findBookingForTimeslotProposal(bookingId: string) {
    return prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        tool: true,
        timeslot: { include: { workshop: true } },
        selectedTools: { include: { workshopTool: true } },
        timeslotProposals: {
          orderBy: { createdAt: "asc" },
          include: {
            proposedBy: { select: { id: true, name: true } }
          }
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
      proposedReturnTime: Date;
      previousPickupTime: Date | null;
      previousReturnTime: Date | null;
    }
  ) {
    return tx.bookingPickupProposal.create({
      data: {
        bookingId: input.bookingId,
        proposedByUserId: input.proposedByUserId,
        proposedPickupTime: input.proposedPickupTime,
        proposedReturnTime: input.proposedReturnTime,
        previousPickupTime: input.previousPickupTime,
        previousReturnTime: input.previousReturnTime,
        status: "PENDING"
      },
      include: { proposedBy: { select: { id: true, name: true } } }
    });
  },

  declinePendingTimeslotProposals(tx: Prisma.TransactionClient, bookingId: string) {
    return tx.bookingTimeslotProposal.updateMany({
      where: { bookingId, status: "PENDING" },
      data: { status: "DECLINED" }
    });
  },

  createTimeslotProposal(
    tx: Prisma.TransactionClient,
    input: {
      bookingId: string;
      proposedByUserId: string;
      proposedStartDate: Date;
      proposedEndDate: Date;
      previousStartDate: Date | null;
      previousEndDate: Date | null;
    }
  ) {
    return tx.bookingTimeslotProposal.create({
      data: {
        bookingId: input.bookingId,
        proposedByUserId: input.proposedByUserId,
        proposedStartDate: input.proposedStartDate,
        proposedEndDate: input.proposedEndDate,
        previousStartDate: input.previousStartDate,
        previousEndDate: input.previousEndDate,
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

  createWorkshopBookingTransaction(input: {
    userId: string;
    workshopId: string;
    startDate: Date;
    endDate: Date;
    workshopToolIds: string[];
  }) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const uniqueWorkshopToolIds = Array.from(new Set(input.workshopToolIds));
      if (uniqueWorkshopToolIds.length === 0) {
        return "TOOLS_REQUIRED" as const;
      }

      const workshop = await tx.workshop.findUnique({
        where: { id: input.workshopId }
      });
      if (!workshop) {
        return "WORKSHOP_NOT_FOUND" as const;
      }

      const overlappingBlockedSlot = await tx.timeSlot.findFirst({
        where: {
          workshopId: input.workshopId,
          blockedByOwner: true,
          startTime: { lt: input.endDate },
          endTime: { gt: input.startDate }
        }
      });
      if (overlappingBlockedSlot) {
        return "BLOCKED" as const;
      }

      const requestedInAvailability = await tx.timeSlot.findFirst({
        where: {
          workshopId: input.workshopId,
          blockedByOwner: false,
          startTime: { lte: input.startDate },
          endTime: { gte: input.endDate }
        },
        orderBy: { startTime: "asc" }
      });
      if (!requestedInAvailability) {
        return "OUTSIDE_AVAILABILITY" as const;
      }

      const existing = await tx.booking.findFirst({
        where: {
          timeslot: { workshopId: input.workshopId },
          status: { in: BLOCKING_BOOKING_STATUSES },
          startDate: { lt: input.endDate },
          endDate: { gt: input.startDate }
        }
      });

      if (existing) {
        return "CONFLICT" as const;
      }

      const selectedWorkshopTools = await tx.workshopTool.findMany({
        where: {
          id: { in: uniqueWorkshopToolIds },
          workshopId: input.workshopId
        }
      });
      if (selectedWorkshopTools.length !== uniqueWorkshopToolIds.length) {
        return "TOOLS_INVALID" as const;
      }

      const booking = await tx.booking.create({
        data: {
          userId: input.userId,
          timeslotId: requestedInAvailability.id,
          startDate: input.startDate,
          endDate: input.endDate,
          status: "PENDING"
        }
      });

      await tx.bookingSelectedTool.createMany({
        data: uniqueWorkshopToolIds.map((workshopToolId) => ({
          bookingId: booking.id,
          workshopToolId
        }))
      });

      return tx.booking.findUnique({
        where: { id: booking.id },
        include: {
          timeslot: { include: { workshop: true } },
          selectedTools: { include: { workshopTool: true } }
        }
      });
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
