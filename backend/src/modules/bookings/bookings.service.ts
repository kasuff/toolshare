import { AppError } from "../../utils/app-error";
import { prisma } from "../../config/prisma";
import { bookingsRepository } from "./bookings.repository";
import { notificationsRepository } from "../notifications/notifications.repository";
import { computePreviousPickupForNewProposal } from "./bookings.pickup.utils";

const BLOCKING_BOOKING_STATUSES: Array<"PENDING" | "ACCEPTED"> = ["PENDING", "ACCEPTED"];

function getProviderId(booking: {
  tool?: { ownerId: string } | null;
  timeslot?: { workshop?: { managerId: string } | null } | null;
}): string | null {
  if (booking.tool?.ownerId) return booking.tool.ownerId;
  if (booking.timeslot?.workshop?.managerId) return booking.timeslot.workshop.managerId;
  return null;
}

export const bookingsService = {
  listForUserContext(userId: string) {
    return bookingsRepository.listForUserContext(userId);
  },

  async createToolBooking(input: {
    requesterId: string;
    toolId: string;
    startDate: string;
    endDate: string;
    pickupTime: string;
  }) {
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    const pickupTime = new Date(input.pickupTime);

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      Number.isNaN(pickupTime.getTime()) ||
      startDate >= endDate
    ) {
      throw new AppError("INVALID_TIME_RANGE", "Invalid booking time range", 400);
    }

    const result = await bookingsRepository.createToolBookingTransaction({
      userId: input.requesterId,
      toolId: input.toolId,
      startDate,
      endDate,
      pickupTime
    });

    if (result === null) {
      throw new AppError("TOOL_NOT_FOUND", "Tool not found", 404);
    }
    if (result === "CONFLICT") {
      throw new AppError(
        "BOOKING_CONFLICT",
        "Resource is unavailable in the selected period",
        409
      );
    }

    await notificationsRepository.create(result.tool.ownerId, "Neue Ausleihanfrage für dein Werkzeug.");
    return result.booking;
  },

  async createWorkshopBooking(input: {
    requesterId: string;
    workshopId: string;
    startDate: string;
    endDate: string;
    workshopToolIds: string[];
  }) {
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate >= endDate) {
      throw new AppError("INVALID_TIME_RANGE", "Invalid booking time range", 400);
    }

    const result = await bookingsRepository.createWorkshopBookingTransaction({
      userId: input.requesterId,
      workshopId: input.workshopId,
      startDate,
      endDate,
      workshopToolIds: input.workshopToolIds
    });

    if (result === "WORKSHOP_NOT_FOUND") {
      throw new AppError("WORKSHOP_NOT_FOUND", "Workshop not found", 404);
    }
    if (result === "CONFLICT") {
      throw new AppError(
        "BOOKING_CONFLICT",
        "Resource is unavailable in the selected period",
        409
      );
    }
    if (result === "OUTSIDE_AVAILABILITY") {
      throw new AppError(
        "WORKSHOP_TIMESLOT_INVALID",
        "Requested workshop range must be fully inside an available workshop slot",
        409
      );
    }
    if (result === "BLOCKED") {
      throw new AppError("TIMESLOT_BLOCKED", "Timeslot is blocked by workshop owner", 409);
    }
    if (result === "TOOLS_REQUIRED") {
      throw new AppError("WORKSHOP_TOOLS_REQUIRED", "At least one required tool must be selected", 400);
    }
    if (result === "TOOLS_INVALID") {
      throw new AppError(
        "WORKSHOP_TOOLS_INVALID",
        "Selected tools are invalid for this workshop booking",
        400
      );
    }
    if (result === null) {
      throw new AppError("BOOKING_CONFLICT", "Resource is unavailable in the selected period", 409);
    }
    const providerId = result.timeslot?.workshop?.managerId ?? null;
    if (providerId && providerId !== input.requesterId) {
      await notificationsRepository.create(providerId, "Neue Buchungsanfrage für deine Werkstatt.");
    }
    return result;
  },

  async updateBookingStatus(input: {
    actorId: string;
    actorRole: "USER" | "MODERATOR" | "MANAGER";
    bookingId: string;
    status: "PENDING" | "ACCEPTED" | "REJECTED" | "RETURNED";
  }) {
    const booking = await bookingsRepository.findBookingById(input.bookingId);
    if (!booking) {
      throw new AppError("BOOKING_NOT_FOUND", "Booking not found", 404);
    }

    const providerId = getProviderId(booking);
    const isRequester = booking.userId === input.actorId;
    const isProvider = providerId !== null && providerId === input.actorId;
    const isModeratorOrManager = input.actorRole === "MODERATOR" || input.actorRole === "MANAGER";

    if (input.status === "RETURNED") {
      if (!isProvider && !isModeratorOrManager) {
        throw new AppError("FORBIDDEN", "Only the provider can complete a booking", 403);
      }
      if (booking.status !== "ACCEPTED") {
        throw new AppError("INVALID_STATE", "Only accepted bookings can be completed", 400);
      }
      if (booking.endDate.getTime() > Date.now()) {
        throw new AppError("BOOKING_NOT_ENDED", "Booking can only be completed after the usage period has ended", 400);
      }
    } else if (!isProvider && !isModeratorOrManager) {
      throw new AppError("FORBIDDEN", "Only provider or moderation roles can update booking", 403);
    }

    const updated = await bookingsRepository.updateStatus(input.bookingId, input.status);
    if (input.status === "RETURNED" && booking.tool?.id) {
      await bookingsRepository.markToolAvailable(booking.tool.id);
    }

    let notifyUserId: string | null = null;
    if (input.status === "RETURNED") {
      notifyUserId = booking.userId;
    } else {
      notifyUserId = booking.userId;
    }
    if (notifyUserId && notifyUserId !== input.actorId) {
      await notificationsRepository.create(notifyUserId, `Deine Buchung wurde auf ${input.status} gesetzt.`);
    }
    return updated;
  },

  async createPickupProposal(input: {
    actorId: string;
    bookingId: string;
    pickupTime: string;
    returnTime: string;
  }) {
    const booking = await bookingsRepository.findBookingForPickupProposal(input.bookingId);
    if (!booking) {
      throw new AppError("BOOKING_NOT_FOUND", "Booking not found", 404);
    }
    if (booking.status !== "PENDING") {
      throw new AppError("INVALID_STATE", "Booking is not open for negotiation", 400);
    }
    if (!booking.pickupTime) {
      throw new AppError(
        "NO_PICKUP",
        "Alternativvorschlag nur bei Ausleihanfragen mit Abholzeit möglich.",
        400
      );
    }

    const providerId = getProviderId(booking);
    if (!providerId) {
      throw new AppError("INVALID_BOOKING", "Booking has no provider", 400);
    }

    const isRequester = booking.userId === input.actorId;
    const isProvider = providerId === input.actorId;
    if (!isRequester && !isProvider) {
      throw new AppError("FORBIDDEN", "Not a participant", 403);
    }

    const pickup = new Date(input.pickupTime);
    const returnTime = new Date(input.returnTime);
    if (
      Number.isNaN(pickup.getTime()) ||
      Number.isNaN(returnTime.getTime()) ||
      pickup >= returnTime
    ) {
      throw new AppError("INVALID_TIME_RANGE", "Invalid booking time range", 400);
    }

    if (booking.toolId) {
      const conflict = await prisma.booking.findFirst({
        where: {
          id: { not: booking.id },
          toolId: booking.toolId,
          status: { in: BLOCKING_BOOKING_STATUSES },
          startDate: { lt: returnTime },
          endDate: { gt: pickup }
        }
      });
      if (conflict) {
        throw new AppError("BOOKING_CONFLICT", "Resource is unavailable in the selected period", 409);
      }
    }

    const proposalsAsc = booking.pickupProposals;
    const previousPickupTime = computePreviousPickupForNewProposal(booking, proposalsAsc);
    const latestPending = proposalsAsc.filter((proposal) => proposal.status === "PENDING").at(-1);
    const previousReturnTime = latestPending?.proposedReturnTime ?? booking.endDate;

    const created = await prisma.$transaction(async (tx) => {
      await bookingsRepository.declinePendingPickupProposals(tx, booking.id);
      return bookingsRepository.createPickupProposal(tx, {
        bookingId: booking.id,
        proposedByUserId: input.actorId,
        proposedPickupTime: pickup,
        proposedReturnTime: returnTime,
        previousPickupTime,
        previousReturnTime
      });
    });

    const recipientId = isRequester ? providerId : booking.userId;
    await notificationsRepository.create(recipientId, "Neuer Alternativvorschlag zu einer Ausleihanfrage.");

    return created;
  },

  async respondPickupProposal(input: {
    actorId: string;
    bookingId: string;
    proposalId: string;
    decision: "ACCEPT" | "DECLINE";
  }) {
    const proposalRow = await prisma.bookingPickupProposal.findFirst({
      where: { id: input.proposalId, bookingId: input.bookingId },
      include: {
        booking: {
          include: {
            tool: true,
            timeslot: { include: { workshop: true } }
          }
        }
      }
    });

    if (!proposalRow) {
      throw new AppError("PROPOSAL_NOT_FOUND", "Proposal not found", 404);
    }
    if (proposalRow.status !== "PENDING") {
      throw new AppError("INVALID_STATE", "Proposal is no longer pending", 400);
    }
    if (proposalRow.proposedByUserId === input.actorId) {
      throw new AppError("FORBIDDEN", "Cannot respond to own proposal", 403);
    }

    const booking = proposalRow.booking;
    const providerId = getProviderId(booking);
    if (!providerId) {
      throw new AppError("INVALID_BOOKING", "Booking has no provider", 400);
    }

    const isRequester = booking.userId === input.actorId;
    const isProvider = providerId === input.actorId;
    if (!isRequester && !isProvider) {
      throw new AppError("FORBIDDEN", "Not a participant", 403);
    }

    if (input.decision === "DECLINE") {
      await prisma.bookingPickupProposal.update({
        where: { id: input.proposalId },
        data: { status: "DECLINED" }
      });
      await notificationsRepository.create(
        proposalRow.proposedByUserId,
        "Dein Alternativvorschlag wurde abgelehnt."
      );
      return prisma.bookingPickupProposal.findUnique({
        where: { id: input.proposalId },
        include: { proposedBy: { select: { id: true, name: true } } }
      });
    }

    const proposedReturnTime = proposalRow.proposedReturnTime ?? booking.endDate;
    if (booking.tool?.id) {
      const conflict = await prisma.booking.findFirst({
        where: {
          id: { not: booking.id },
          toolId: booking.tool.id,
          status: { in: BLOCKING_BOOKING_STATUSES },
          startDate: { lt: proposedReturnTime },
          endDate: { gt: proposalRow.proposedPickupTime }
        }
      });
      if (conflict) {
        throw new AppError("BOOKING_CONFLICT", "Resource is unavailable in the selected period", 409);
      }
    }

    await prisma.$transaction([
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
          pickupTime: proposalRow.proposedPickupTime,
          startDate: proposalRow.proposedPickupTime,
          endDate: proposedReturnTime
        }
      })
    ]);

    await notificationsRepository.create(
      proposalRow.proposedByUserId,
      "Dein Alternativvorschlag wurde angenommen."
    );

    return prisma.bookingPickupProposal.findUnique({
      where: { id: input.proposalId },
      include: { proposedBy: { select: { id: true, name: true } } }
    });
  },

  async createTimeslotProposal(input: {
    actorId: string;
    bookingId: string;
    startDate: string;
    endDate: string;
  }) {
    const booking = await bookingsRepository.findBookingForTimeslotProposal(input.bookingId);
    if (!booking) {
      throw new AppError("BOOKING_NOT_FOUND", "Booking not found", 404);
    }
    if (booking.status !== "PENDING") {
      throw new AppError("INVALID_STATE", "Booking is not open for negotiation", 400);
    }
    if (!booking.timeslot) {
      throw new AppError("TIMESLOT_NOT_FOUND", "Timeslot not found", 404);
    }

    const proposedStartDate = new Date(input.startDate);
    const proposedEndDate = new Date(input.endDate);
    if (
      Number.isNaN(proposedStartDate.getTime()) ||
      Number.isNaN(proposedEndDate.getTime()) ||
      proposedStartDate >= proposedEndDate
    ) {
      throw new AppError("INVALID_TIME_RANGE", "Invalid booking time range", 400);
    }

    const providerId = getProviderId(booking);
    if (!providerId) {
      throw new AppError("INVALID_BOOKING", "Booking has no provider", 400);
    }

    const isRequester = booking.userId === input.actorId;
    const isProvider = providerId === input.actorId;
    if (!isRequester && !isProvider) {
      throw new AppError("FORBIDDEN", "Not a participant", 403);
    }

    await ensureWorkshopProposalCanUseRange(
      booking.id,
      booking.selectedTools,
      booking.timeslot.workshopId,
      proposedStartDate,
      proposedEndDate
    );

    const pending = booking.timeslotProposals.filter((proposal) => proposal.status === "PENDING");
    const latestPending = pending.length > 0 ? pending[pending.length - 1] : null;
    const previousStartDate = latestPending?.proposedStartDate ?? booking.startDate;
    const previousEndDate = latestPending?.proposedEndDate ?? booking.endDate;

    const created = await prisma.$transaction(async (tx) => {
      await bookingsRepository.declinePendingTimeslotProposals(tx, booking.id);
      return bookingsRepository.createTimeslotProposal(tx, {
        bookingId: booking.id,
        proposedByUserId: input.actorId,
        proposedStartDate,
        proposedEndDate,
        previousStartDate,
        previousEndDate
      });
    });

    const recipientId = isRequester ? providerId : booking.userId;
    await notificationsRepository.create(recipientId, "Neuer Alternativvorschlag für die Werkstattbuchung.");

    return created;
  },

  async respondTimeslotProposal(input: {
    actorId: string;
    bookingId: string;
    proposalId: string;
    decision: "ACCEPT" | "DECLINE";
  }) {
    const proposalRow = await prisma.bookingTimeslotProposal.findFirst({
      where: { id: input.proposalId, bookingId: input.bookingId },
      include: {
        proposedBy: { select: { id: true, name: true } },
        booking: {
          include: {
            tool: true,
            selectedTools: { include: { workshopTool: true } },
            timeslot: { include: { workshop: true } }
          }
        }
      }
    });

    if (!proposalRow) {
      throw new AppError("PROPOSAL_NOT_FOUND", "Proposal not found", 404);
    }
    if (proposalRow.status !== "PENDING") {
      throw new AppError("INVALID_STATE", "Proposal is no longer pending", 400);
    }
    if (proposalRow.proposedByUserId === input.actorId) {
      throw new AppError("FORBIDDEN", "Cannot respond to own proposal", 403);
    }

    const booking = proposalRow.booking;
    if (!booking.timeslot) {
      throw new AppError("TIMESLOT_NOT_FOUND", "Timeslot not found", 404);
    }
    const providerId = getProviderId(booking);
    if (!providerId) {
      throw new AppError("INVALID_BOOKING", "Booking has no provider", 400);
    }

    const isRequester = booking.userId === input.actorId;
    const isProvider = providerId === input.actorId;
    if (!isRequester && !isProvider) {
      throw new AppError("FORBIDDEN", "Not a participant", 403);
    }

    if (input.decision === "DECLINE") {
      await prisma.bookingTimeslotProposal.update({
        where: { id: input.proposalId },
        data: { status: "DECLINED" }
      });
      await notificationsRepository.create(
        proposalRow.proposedByUserId,
        "Dein Alternativvorschlag zur Werkstattbuchung wurde abgelehnt."
      );
      return prisma.bookingTimeslotProposal.findUnique({
        where: { id: input.proposalId },
        include: { proposedBy: { select: { id: true, name: true } } }
      });
    }

    const { availabilitySlotId } = await ensureWorkshopProposalCanUseRange(
      booking.id,
      booking.selectedTools,
      booking.timeslot.workshopId,
      proposalRow.proposedStartDate,
      proposalRow.proposedEndDate
    );

    await prisma.$transaction([
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
          timeslotId: availabilitySlotId,
          startDate: proposalRow.proposedStartDate,
          endDate: proposalRow.proposedEndDate
        }
      })
    ]);

    await notificationsRepository.create(
      proposalRow.proposedByUserId,
      "Dein Alternativvorschlag zur Werkstattbuchung wurde angenommen."
    );

    return prisma.bookingTimeslotProposal.findUnique({
      where: { id: input.proposalId },
      include: { proposedBy: { select: { id: true, name: true } } }
    });
  }
};

async function ensureWorkshopProposalCanUseRange(
  bookingId: string,
  selectedTools: Array<{ workshopToolId: string; workshopTool: { workshopId: string } }>,
  workshopId: string,
  startDate: Date,
  endDate: Date
) {
  const overlappingBlockedSlot = await prisma.timeSlot.findFirst({
    where: {
      workshopId,
      blockedByOwner: true,
      startTime: { lt: endDate },
      endTime: { gt: startDate }
    }
  });
  if (overlappingBlockedSlot) {
    throw new AppError("TIMESLOT_BLOCKED", "Timeslot is blocked by workshop owner", 409);
  }

  const availabilitySlot = await prisma.timeSlot.findFirst({
    where: {
      workshopId,
      blockedByOwner: false,
      startTime: { lte: startDate },
      endTime: { gte: endDate }
    },
    orderBy: { startTime: "asc" }
  });
  if (!availabilitySlot) {
    throw new AppError(
      "WORKSHOP_TIMESLOT_INVALID",
      "Alternative workshop range must be fully inside an available workshop slot",
      409
    );
  }

  const existingBooking = await prisma.booking.findFirst({
    where: {
      id: { not: bookingId },
      timeslot: { workshopId },
      status: { in: BLOCKING_BOOKING_STATUSES },
      startDate: { lt: endDate },
      endDate: { gt: startDate }
    }
  });
  if (existingBooking) {
    throw new AppError("BOOKING_CONFLICT", "Resource is unavailable in the selected period", 409);
  }

  const allBelongToWorkshop = selectedTools.every(
    (selectedTool) => selectedTool.workshopTool.workshopId === workshopId
  );
  if (!allBelongToWorkshop) {
    throw new AppError("WORKSHOP_TOOLS_INVALID", "Selected tools are invalid for this workshop booking", 400);
  }

  return { availabilitySlotId: availabilitySlot.id };
}
