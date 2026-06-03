import { AppError } from "../../utils/app-error";
import { prisma } from "../../config/prisma";
import { bookingsRepository } from "./bookings.repository";
import { notificationsRepository } from "../notifications/notifications.repository";
import { computePreviousPickupForNewProposal } from "./bookings.pickup.utils";

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

    await notificationsRepository.create(result.tool.ownerId, "Neue Ausleihanfrage fuer dein Werkzeug.");
    return result.booking;
  },

  async createWorkshopBooking(input: { requesterId: string; timeslotId: string }) {
    const result = await bookingsRepository.createWorkshopBookingTransaction({
      userId: input.requesterId,
      timeslotId: input.timeslotId
    });

    if (result === null) {
      throw new AppError("TIMESLOT_NOT_FOUND", "Timeslot not found", 404);
    }
    if (result === "CONFLICT") {
      throw new AppError(
        "BOOKING_CONFLICT",
        "Resource is unavailable in the selected period",
        409
      );
    }
    if (result === "BLOCKED") {
      throw new AppError("TIMESLOT_BLOCKED", "Timeslot is blocked by workshop owner", 409);
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

  async createPickupProposal(input: { actorId: string; bookingId: string; pickupTime: string }) {
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

    let pickup = new Date(input.pickupTime);
    if (Number.isNaN(pickup.getTime())) {
      throw new AppError("INVALID_PICKUP", "Invalid pickup time", 400);
    }

    const startMs = booking.startDate.getTime();
    const endMs = booking.endDate.getTime();
    let pickupMs = pickup.getTime();
    // Typische Ursache für 400: lokales Datum/Uhrzeit liegt vor dem Buchungsbeginn (UTC) oder knapp außerhalb — in den Zeitraum clampen.
    if (pickupMs < startMs || pickupMs > endMs) {
      pickupMs = Math.min(Math.max(pickupMs, startMs), endMs);
      pickup = new Date(pickupMs);
    }

    const proposalsAsc = booking.pickupProposals;
    const previousPickupTime = computePreviousPickupForNewProposal(booking, proposalsAsc);

    const created = await prisma.$transaction(async (tx) => {
      await bookingsRepository.declinePendingPickupProposals(tx, booking.id);
      return bookingsRepository.createPickupProposal(tx, {
        bookingId: booking.id,
        proposedByUserId: input.actorId,
        proposedPickupTime: pickup,
        previousPickupTime
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
          pickupTime: proposalRow.proposedPickupTime
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
  }
};
