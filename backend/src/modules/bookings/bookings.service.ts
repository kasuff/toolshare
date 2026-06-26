import { AppError } from "../../utils/app-error";
import { enqueueProposalNotification } from "../../infrastructure/outbox/enqueue-user-notification";
import { bookingsRepository } from "./bookings.repository";
import { systemRulesService } from "../system-rules/system-rules.service";
import { toolsService } from "../tools/tools.service";
import { workshopsService } from "../workshops/workshops.service";
import { computePreviousPickupForNewProposal } from "./bookings.pickup.utils";
import { assertBookingCanBeCompleted } from "./bookings.completion";
import {
  toBookingPickupProposalResponse,
  toBookingResponse,
  toBookingResponseList,
  toBookingTimeslotProposalResponse
} from "./bookings.presenter";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Erzwingt die buchungsbezogenen Systemregeln (Vorlauf, Vorausbuchungszeit und
// – nur bei Werkzeugen – die maximale Ausleihdauer). Die Werte stammen live aus
// den Admin-Systemeinstellungen, Änderungen wirken also sofort.
async function assertBookingRules(
  startDate: Date,
  endDate: Date,
  options: { checkLoanDuration: boolean }
): Promise<void> {
  const values = await systemRulesService.getValues();
  const now = Date.now();

  const leadMs = values.minBookingLeadTimeHours * HOUR_MS;
  if (startDate.getTime() - now < leadMs) {
    throw new AppError(
      "BOOKING_LEAD_TIME",
      `Buchungen müssen mindestens ${values.minBookingLeadTimeHours} Stunden im Voraus erfolgen.`,
      400
    );
  }

  const advanceMs = values.maxAdvanceBookingDays * DAY_MS;
  if (startDate.getTime() - now > advanceMs) {
    throw new AppError(
      "BOOKING_TOO_FAR_AHEAD",
      `Buchungen sind höchstens ${values.maxAdvanceBookingDays} Tage im Voraus möglich.`,
      400
    );
  }

  if (options.checkLoanDuration) {
    const maxDurationMs = values.maxLoanDurationDays * DAY_MS;
    if (endDate.getTime() - startDate.getTime() > maxDurationMs) {
      throw new AppError(
        "BOOKING_TOO_LONG",
        `Die maximale Ausleihdauer beträgt ${values.maxLoanDurationDays} Tage.`,
        400
      );
    }
  }
}

function getProviderId(booking: {
  tool?: { ownerId: string } | null;
  workshop?: { managerId: string } | null;
  timeslot?: { workshop?: { managerId: string } | null } | null;
}): string | null {
  if (booking.tool?.ownerId) return booking.tool.ownerId;
  if (booking.workshop?.managerId) return booking.workshop.managerId;
  if (booking.timeslot?.workshop?.managerId) return booking.timeslot.workshop.managerId;
  return null;
}

/** Werkstatt-ID einer Buchung – bevorzugt die direkte Relation, fällt auf Altdaten (Zeitslot) zurück. */
function getWorkshopId(booking: {
  workshopId?: string | null;
  workshop?: { id: string } | null;
  timeslot?: { workshopId: string } | null;
}): string | null {
  return booking.workshopId ?? booking.workshop?.id ?? booking.timeslot?.workshopId ?? null;
}

export const bookingsService = {
  async listForUserContext(userId: string) {
    const bookings = await bookingsRepository.listForUserContext(userId);
    const visible = bookings.filter((booking) => {
      const providerId = getProviderId(booking);
      return !(booking.userId === userId && providerId === userId);
    });
    return toBookingResponseList(visible);
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

    await assertBookingRules(startDate, endDate, { checkLoanDuration: true });
    await toolsService.getById(input.toolId);

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

    return toBookingResponse(result.booking);
  },

  async createToolOwnerBlock(input: {
    ownerId: string;
    toolId: string;
    startDate: string;
    endDate: string;
  }) {
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate >= endDate) {
      throw new AppError("INVALID_TIME_RANGE", "Invalid booking time range", 400);
    }

    const result = await bookingsRepository.createToolOwnerBlockTransaction({
      ownerId: input.ownerId,
      toolId: input.toolId,
      startDate,
      endDate
    });
    if (result === "TOOL_NOT_FOUND") {
      throw new AppError("TOOL_NOT_FOUND", "Tool not found", 404);
    }
    if (result === "FORBIDDEN") {
      throw new AppError("FORBIDDEN", "Only the tool owner can block this tool", 403);
    }
    if (result === "CONFLICT") {
      throw new AppError("BOOKING_CONFLICT", "Resource is unavailable in the selected period", 409);
    }
    return toBookingResponse(result);
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

    await assertBookingRules(startDate, endDate, { checkLoanDuration: false });
    await workshopsService.getById(input.workshopId);

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
    if (result === "BLOCKED") {
      throw new AppError("TIMESLOT_BLOCKED", "Timeslot is blocked by workshop owner", 409);
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
    return toBookingResponse(result);
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
    const isProvider = providerId !== null && providerId === input.actorId;
    const isModeratorOrManager = input.actorRole === "MODERATOR" || input.actorRole === "MANAGER";

    if (input.status === "RETURNED") {
      assertBookingCanBeCompleted(booking, {
        actorId: input.actorId,
        actorRole: input.actorRole
      });
    } else if (!isProvider && !isModeratorOrManager) {
      throw new AppError("FORBIDDEN", "Only provider or moderation roles can update booking", 403);
    }

    // Anfrage-Modell (Werkzeuge): Offene Anfragen reservieren den Zeitraum nicht,
    // mehrere dürfen sich überlappen. Spätestens beim BESTÄTIGEN muss daher
    // sichergestellt sein, dass keine andere bereits bestätigte Buchung den
    // Zeitraum belegt -- sonst entstünde eine Doppelbuchung.
    if (input.status === "ACCEPTED" && booking.toolId) {
      const conflict = await bookingsRepository.findToolBookingOverlap(
        booking.id,
        booking.toolId,
        booking.startDate,
        booking.endDate
      );
      if (conflict) {
        throw new AppError("BOOKING_CONFLICT", "Resource is unavailable in the selected period", 409);
      }
    }

    const notifyUserId =
      booking.userId !== input.actorId ? booking.userId : undefined;

    const updated = await bookingsRepository.updateStatus(input.bookingId, input.status, {
      notifyUserId,
      markToolAvailableId:
        input.status === "RETURNED" && booking.tool?.id ? booking.tool.id : undefined
    });
    return toBookingResponse(updated);
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
      const conflict = await bookingsRepository.findToolBookingOverlap(
        booking.id,
        booking.toolId,
        pickup,
        returnTime
      );
      if (conflict) {
        throw new AppError("BOOKING_CONFLICT", "Resource is unavailable in the selected period", 409);
      }
    }

    const proposalsAsc = booking.pickupProposals;
    const previousPickupTime = computePreviousPickupForNewProposal(booking, proposalsAsc);
    const latestPending = proposalsAsc.filter((proposal) => proposal.status === "PENDING").at(-1);
    const previousReturnTime = latestPending?.proposedReturnTime ?? booking.endDate;

    const created = await bookingsRepository.runPickupProposalCreation({
      bookingId: booking.id,
      proposedByUserId: input.actorId,
      proposedPickupTime: pickup,
      proposedReturnTime: returnTime,
      previousPickupTime,
      previousReturnTime
    });

    const recipientId = isRequester ? providerId : booking.userId;
    await enqueueProposalNotification({
      bookingId: booking.id,
      userId: recipientId,
      kind: "pickup-created",
      inAppMessage: "Neuer Alternativvorschlag zu einer Ausleihanfrage.",
      pushTitle: "Neuer Alternativvorschlag",
      pushBody: "Neuer Alternativvorschlag zu einer Ausleihanfrage."
    });

    return toBookingPickupProposalResponse(created);
  },

  async respondPickupProposal(input: {
    actorId: string;
    bookingId: string;
    proposalId: string;
    decision: "ACCEPT" | "DECLINE";
  }) {
    const proposalRow = await bookingsRepository.findPickupProposalWithBooking(
      input.proposalId,
      input.bookingId
    );

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
      await bookingsRepository.declinePickupProposal(input.proposalId);
      await enqueueProposalNotification({
        bookingId: input.bookingId,
        userId: proposalRow.proposedByUserId,
        kind: "pickup-declined",
        inAppMessage: "Dein Alternativvorschlag wurde abgelehnt.",
        pushTitle: "Vorschlag abgelehnt",
        pushBody: "Dein Alternativvorschlag wurde abgelehnt."
      });
      const declined = await bookingsRepository.findPickupProposalById(input.proposalId);
      return declined ? toBookingPickupProposalResponse(declined) : null;
    }

    const proposedReturnTime = proposalRow.proposedReturnTime ?? booking.endDate;
    if (booking.tool?.id) {
      const conflict = await bookingsRepository.findToolBookingOverlap(
        booking.id,
        booking.tool.id,
        proposalRow.proposedPickupTime,
        proposedReturnTime
      );
      if (conflict) {
        throw new AppError("BOOKING_CONFLICT", "Resource is unavailable in the selected period", 409);
      }
    }

    await bookingsRepository.acceptPickupProposalTransaction({
      bookingId: input.bookingId,
      proposalId: input.proposalId,
      pickupTime: proposalRow.proposedPickupTime,
      startDate: proposalRow.proposedPickupTime,
      endDate: proposedReturnTime
    });

    await enqueueProposalNotification({
      bookingId: input.bookingId,
      userId: proposalRow.proposedByUserId,
      kind: "pickup-accepted",
      inAppMessage: "Dein Alternativvorschlag wurde angenommen.",
      pushTitle: "Vorschlag angenommen",
      pushBody: "Dein Alternativvorschlag wurde angenommen."
    });

    const accepted = await bookingsRepository.findPickupProposalById(input.proposalId);
    return accepted ? toBookingPickupProposalResponse(accepted) : null;
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
    const workshopId = getWorkshopId(booking);
    if (!workshopId) {
      throw new AppError("TIMESLOT_NOT_FOUND", "Workshop not found", 404);
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
      workshopId,
      proposedStartDate,
      proposedEndDate
    );

    const pending = booking.timeslotProposals.filter((proposal) => proposal.status === "PENDING");
    const latestPending = pending.length > 0 ? pending[pending.length - 1] : null;
    const previousStartDate = latestPending?.proposedStartDate ?? booking.startDate;
    const previousEndDate = latestPending?.proposedEndDate ?? booking.endDate;

    const created = await bookingsRepository.runTimeslotProposalCreation({
      bookingId: booking.id,
      proposedByUserId: input.actorId,
      proposedStartDate,
      proposedEndDate,
      previousStartDate,
      previousEndDate
    });

    const recipientId = isRequester ? providerId : booking.userId;
    await enqueueProposalNotification({
      bookingId: booking.id,
      userId: recipientId,
      kind: "timeslot-created",
      inAppMessage: "Neuer Alternativvorschlag für die Werkstattbuchung.",
      pushTitle: "Neuer Alternativvorschlag",
      pushBody: "Neuer Alternativvorschlag für die Werkstattbuchung."
    });

    return toBookingTimeslotProposalResponse(created);
  },

  async respondTimeslotProposal(input: {
    actorId: string;
    bookingId: string;
    proposalId: string;
    decision: "ACCEPT" | "DECLINE";
  }) {
    const proposalRow = await bookingsRepository.findTimeslotProposalWithBooking(
      input.proposalId,
      input.bookingId
    );

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
    const workshopId = getWorkshopId(booking);
    if (!workshopId) {
      throw new AppError("TIMESLOT_NOT_FOUND", "Workshop not found", 404);
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
      await bookingsRepository.declineTimeslotProposal(input.proposalId);
      await enqueueProposalNotification({
        bookingId: input.bookingId,
        userId: proposalRow.proposedByUserId,
        kind: "timeslot-declined",
        inAppMessage: "Dein Alternativvorschlag zur Werkstattbuchung wurde abgelehnt.",
        pushTitle: "Vorschlag abgelehnt",
        pushBody: "Dein Alternativvorschlag zur Werkstattbuchung wurde abgelehnt."
      });
      const declined = await bookingsRepository.findTimeslotProposalById(input.proposalId);
      return declined ? toBookingTimeslotProposalResponse(declined) : null;
    }

    await ensureWorkshopProposalCanUseRange(
      booking.id,
      booking.selectedTools,
      workshopId,
      proposalRow.proposedStartDate,
      proposalRow.proposedEndDate
    );

    await bookingsRepository.acceptTimeslotProposalTransaction({
      bookingId: input.bookingId,
      proposalId: input.proposalId,
      workshopId,
      startDate: proposalRow.proposedStartDate,
      endDate: proposalRow.proposedEndDate
    });

    await enqueueProposalNotification({
      bookingId: input.bookingId,
      userId: proposalRow.proposedByUserId,
      kind: "timeslot-accepted",
      inAppMessage: "Dein Alternativvorschlag zur Werkstattbuchung wurde angenommen.",
      pushTitle: "Vorschlag angenommen",
      pushBody: "Dein Alternativvorschlag zur Werkstattbuchung wurde angenommen."
    });

    const accepted = await bookingsRepository.findTimeslotProposalById(input.proposalId);
    return accepted ? toBookingTimeslotProposalResponse(accepted) : null;
  }
};

async function ensureWorkshopProposalCanUseRange(
  bookingId: string,
  selectedTools: Array<{ workshopToolId: string; workshopTool: { workshopId: string } }>,
  workshopId: string,
  startDate: Date,
  endDate: Date
) {
  // Eine Werkstatt ist standardmäßig verfügbar. Nur vom Anbieter blockierte Zeiten sperren den Zeitraum.
  const overlappingBlockedSlot = await bookingsRepository.findOverlappingBlockedWorkshopSlot(
    workshopId,
    startDate,
    endDate
  );
  if (overlappingBlockedSlot) {
    throw new AppError("TIMESLOT_BLOCKED", "Timeslot is blocked by workshop owner", 409);
  }

  const existingBooking = await bookingsRepository.findWorkshopBookingOverlap(
    bookingId,
    workshopId,
    startDate,
    endDate
  );
  if (existingBooking) {
    throw new AppError("BOOKING_CONFLICT", "Resource is unavailable in the selected period", 409);
  }

  const allBelongToWorkshop = selectedTools.every(
    (selectedTool) => selectedTool.workshopTool.workshopId === workshopId
  );
  if (!allBelongToWorkshop) {
    throw new AppError("WORKSHOP_TOOLS_INVALID", "Selected tools are invalid for this workshop booking", 400);
  }
}
