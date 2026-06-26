import { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { notificationOutboxService } from "../../infrastructure/outbox/notification-outbox.service";

/** Buchungen in diesen Statusen blockieren Werkzeug-Zeiträume bzw. Werkstatt-Slots. */
const BLOCKING_BOOKING_STATUSES: BookingStatus[] = ["PENDING", "ACCEPTED"];

export const bookingsRepository = {
  listForUserContext(userId: string) {
    return prisma.booking.findMany({
      where: {
        OR: [
          { userId },
          { tool: { ownerId: userId } },
          { workshop: { managerId: userId } },
          { timeslot: { workshop: { managerId: userId } } }
        ]
      },
      include: {
        user: { select: { id: true, name: true } },
        tool: { include: { owner: { select: { id: true, name: true } } } },
        workshop: { include: { manager: { select: { id: true, name: true } } } },
        timeslot: { include: { workshop: { include: { manager: { select: { id: true, name: true } } } } } },
        selectedTools: { include: { workshopTool: true } },
        // Sicherheits-Cap gegen pathologisch lange Verhandlungen (real nur wenige
        // Proposals). Echtes Lazy-Laden der Nachrichten je geöffnetem Chat ist als
        // Folgeschritt vorgesehen (siehe Architektur-Doku "Performance, Indizes
        // & Pagination" im project-management-Repo).
        pickupProposals: {
          orderBy: { createdAt: "asc" },
          take: 100,
          include: { proposedBy: { select: { id: true, name: true } } }
        },
        timeslotProposals: {
          orderBy: { createdAt: "asc" },
          take: 100,
          include: {
            proposedBy: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      // Neueste 100 Konversationen. Thread-Listen-Pagination ist Folgeschritt.
      take: 100
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
        workshop: true,
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
        workshop: true,
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
        workshop: true,
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

      await notificationOutboxService.scheduleToolBookingRequestNotification(tx, {
        bookingId: booking.id,
        ownerId: tool.ownerId
      });

      return { booking, tool };
    });
  },

  createToolOwnerBlockTransaction(input: {
    ownerId: string;
    toolId: string;
    startDate: Date;
    endDate: Date;
  }) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const tool = await tx.tool.findUnique({ where: { id: input.toolId } });
      if (!tool) return "TOOL_NOT_FOUND" as const;
      if (tool.ownerId !== input.ownerId) return "FORBIDDEN" as const;

      const overlap = await tx.booking.findFirst({
        where: {
          toolId: input.toolId,
          status: { in: BLOCKING_BOOKING_STATUSES },
          startDate: { lt: input.endDate },
          endDate: { gt: input.startDate }
        }
      });
      if (overlap) return "CONFLICT" as const;

      return tx.booking.create({
        data: {
          userId: input.ownerId,
          toolId: input.toolId,
          startDate: input.startDate,
          endDate: input.endDate,
          pickupTime: input.startDate,
          status: "ACCEPTED"
        }
      });
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

      const workshop = await tx.workshop.findUnique({
        where: { id: input.workshopId }
      });
      if (!workshop) {
        return "WORKSHOP_NOT_FOUND" as const;
      }

      // Eine Werkstatt ist standardmäßig verfügbar. Nur vom Anbieter blockierte Zeiten
      // (blockedByOwner=true) schließen einen Zeitraum aus.
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

      const existing = await tx.booking.findFirst({
        where: {
          OR: [{ workshopId: input.workshopId }, { timeslot: { workshopId: input.workshopId } }],
          status: { in: BLOCKING_BOOKING_STATUSES },
          startDate: { lt: input.endDate },
          endDate: { gt: input.startDate }
        }
      });

      if (existing) {
        return "CONFLICT" as const;
      }

      if (uniqueWorkshopToolIds.length > 0) {
        const selectedWorkshopTools = await tx.workshopTool.findMany({
          where: {
            id: { in: uniqueWorkshopToolIds },
            workshopId: input.workshopId
          }
        });
        if (selectedWorkshopTools.length !== uniqueWorkshopToolIds.length) {
          return "TOOLS_INVALID" as const;
        }
      }

      const booking = await tx.booking.create({
        data: {
          userId: input.userId,
          workshopId: input.workshopId,
          startDate: input.startDate,
          endDate: input.endDate,
          status: "PENDING"
        }
      });

      if (uniqueWorkshopToolIds.length > 0) {
        await tx.bookingSelectedTool.createMany({
          data: uniqueWorkshopToolIds.map((workshopToolId) => ({
            bookingId: booking.id,
            workshopToolId
          }))
        });
      }

      const providerId = workshop.managerId;
      if (providerId !== input.userId) {
        await notificationOutboxService.scheduleWorkshopBookingRequestNotification(tx, {
          bookingId: booking.id,
          providerId
        });
      }

      return tx.booking.findUnique({
        where: { id: booking.id },
        include: {
          workshop: { include: { manager: { select: { id: true, name: true } } } },
          timeslot: { include: { workshop: true } },
          selectedTools: { include: { workshopTool: true } }
        }
      });
    });
  },

  updateStatus(
    id: string,
    status: "PENDING" | "ACCEPTED" | "REJECTED" | "RETURNED",
    options?: { notifyUserId?: string; markToolAvailableId?: string }
  ) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id },
        data: { status }
      });

      if (options?.markToolAvailableId) {
        await tx.tool.update({
          where: { id: options.markToolAvailableId },
          data: { status: "AVAILABLE" }
        });
      }

      if (options?.notifyUserId) {
        await notificationOutboxService.scheduleBookingStatusNotification(tx, {
          bookingId: id,
          userId: options.notifyUserId,
          status
        });
      }

      return updated;
    });
  },

  markToolAvailable(toolId: string) {
    return prisma.tool.update({
      where: { id: toolId },
      data: { status: "AVAILABLE" }
    });
  },

  findToolBookingOverlap(excludeBookingId: string, toolId: string, start: Date, end: Date) {
    return prisma.booking.findFirst({
      where: {
        id: { not: excludeBookingId },
        toolId,
        status: { in: BLOCKING_BOOKING_STATUSES },
        startDate: { lt: end },
        endDate: { gt: start }
      }
    });
  },

  runPickupProposalCreation(input: {
    bookingId: string;
    proposedByUserId: string;
    proposedPickupTime: Date;
    proposedReturnTime: Date;
    previousPickupTime: Date | null;
    previousReturnTime: Date | null;
  }) {
    return prisma.$transaction(async (tx) => {
      await bookingsRepository.declinePendingPickupProposals(tx, input.bookingId);
      return bookingsRepository.createPickupProposal(tx, input);
    });
  },

  findPickupProposalWithBooking(proposalId: string, bookingId: string) {
    return prisma.bookingPickupProposal.findFirst({
      where: { id: proposalId, bookingId },
      include: {
        booking: {
          include: {
            tool: true,
            timeslot: { include: { workshop: true } }
          }
        }
      }
    });
  },

  declinePickupProposal(proposalId: string) {
    return prisma.bookingPickupProposal.update({
      where: { id: proposalId },
      data: { status: "DECLINED" }
    });
  },

  findPickupProposalById(proposalId: string) {
    return prisma.bookingPickupProposal.findUnique({
      where: { id: proposalId },
      include: { proposedBy: { select: { id: true, name: true } } }
    });
  },

  acceptPickupProposalTransaction(input: {
    bookingId: string;
    proposalId: string;
    pickupTime: Date;
    startDate: Date;
    endDate: Date;
  }) {
    return prisma.$transaction([
      prisma.bookingPickupProposal.updateMany({
        where: {
          bookingId: input.bookingId,
          status: "PENDING",
          id: { not: input.proposalId }
        },
        data: { status: "DECLINED" }
      }),
      prisma.bookingPickupProposal.update({
        where: { id: input.proposalId },
        data: { status: "ACCEPTED" }
      }),
      prisma.booking.update({
        where: { id: input.bookingId },
        data: {
          status: "ACCEPTED",
          pickupTime: input.pickupTime,
          startDate: input.startDate,
          endDate: input.endDate
        }
      })
    ]);
  },

  runTimeslotProposalCreation(input: {
    bookingId: string;
    proposedByUserId: string;
    proposedStartDate: Date;
    proposedEndDate: Date;
    previousStartDate: Date | null;
    previousEndDate: Date | null;
  }) {
    return prisma.$transaction(async (tx) => {
      await bookingsRepository.declinePendingTimeslotProposals(tx, input.bookingId);
      return bookingsRepository.createTimeslotProposal(tx, input);
    });
  },

  findTimeslotProposalWithBooking(proposalId: string, bookingId: string) {
    return prisma.bookingTimeslotProposal.findFirst({
      where: { id: proposalId, bookingId },
      include: {
        proposedBy: { select: { id: true, name: true } },
        booking: {
          include: {
            tool: true,
            workshop: true,
            selectedTools: { include: { workshopTool: true } },
            timeslot: { include: { workshop: true } }
          }
        }
      }
    });
  },

  declineTimeslotProposal(proposalId: string) {
    return prisma.bookingTimeslotProposal.update({
      where: { id: proposalId },
      data: { status: "DECLINED" }
    });
  },

  findTimeslotProposalById(proposalId: string) {
    return prisma.bookingTimeslotProposal.findUnique({
      where: { id: proposalId },
      include: { proposedBy: { select: { id: true, name: true } } }
    });
  },

  acceptTimeslotProposalTransaction(input: {
    bookingId: string;
    proposalId: string;
    workshopId: string;
    startDate: Date;
    endDate: Date;
  }) {
    return prisma.$transaction([
      prisma.bookingTimeslotProposal.updateMany({
        where: {
          bookingId: input.bookingId,
          status: "PENDING",
          id: { not: input.proposalId }
        },
        data: { status: "DECLINED" }
      }),
      prisma.bookingTimeslotProposal.update({
        where: { id: input.proposalId },
        data: { status: "ACCEPTED" }
      }),
      prisma.booking.update({
        where: { id: input.bookingId },
        data: {
          status: "ACCEPTED",
          workshopId: input.workshopId,
          startDate: input.startDate,
          endDate: input.endDate
        }
      })
    ]);
  },

  findOverlappingBlockedWorkshopSlot(workshopId: string, start: Date, end: Date) {
    return prisma.timeSlot.findFirst({
      where: {
        workshopId,
        blockedByOwner: true,
        startTime: { lt: end },
        endTime: { gt: start }
      }
    });
  },

  findWorkshopBookingOverlap(excludeBookingId: string, workshopId: string, start: Date, end: Date) {
    return prisma.booking.findFirst({
      where: {
        id: { not: excludeBookingId },
        OR: [{ workshopId }, { timeslot: { workshopId } }],
        status: { in: BLOCKING_BOOKING_STATUSES },
        startDate: { lt: end },
        endDate: { gt: start }
      }
    });
  }
};
