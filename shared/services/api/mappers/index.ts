import { DEFAULT_PLACEHOLDER_IMAGE, normalizePlaceholderImage } from "../../../utils/categories";
import type {
  Booking,
  BookingSelectedTool,
  PickupProposal,
  PublicRating,
  Rating,
  TimeslotProposal,
  Tool,
  Workshop,
  WorkshopBookedRange,
  WorkshopSlot
} from "../../../types/domain";
import type {
  BackendBooking,
  BackendPickupProposal,
  BackendRating,
  BackendTimeslotProposal,
  BackendTool,
  BackendWorkshop,
  BackendWorkshopBookedRange,
  BackendWorkshopTimeslot
} from "../types";
import { bookingStatusMap, toolStatusMap } from "./roles";
import { toLocalDateTimeInputValue } from "../client";

function mapTool(tool: BackendTool): Tool {
  return {
    id: tool.id,
    ownerId: tool.ownerId,
    ownerName: tool.owner?.name,
    name: tool.name,
    description: tool.description,
    category: tool.category,
    status: toolStatusMap[tool.status],
    imageUrl: normalizePlaceholderImage(tool.imageUrl),
    pickupLocation: tool.pickupLocation ?? "",
    pickupLocationNote: tool.pickupLocationNote ?? undefined,
    pickupLat: tool.pickupLat ?? undefined,
    pickupLon: tool.pickupLon ?? undefined,
    bookedRanges: mapWorkshopBookedRanges(tool.bookings)
  };
}

function mapWorkshop(workshop: BackendWorkshop): Workshop {
  const extras = workshop.extras ?? workshop.equipment ?? [];
  return {
    id: workshop.id,
    ownerId: workshop.managerId,
    ownerName: workshop.manager?.name,
    name: workshop.name,
    description: workshop.description,
    location: workshop.location,
    latitude: workshop.latitude ?? undefined,
    longitude: workshop.longitude ?? undefined,
    maxCapacity: workshop.maxCapacity,
    extras,
    equipmentItems: (workshop.workshopTools ?? []).map((tool) => ({
      id: tool.id,
      name: tool.name,
      category: tool.category
    })),
    imageUrls:
      workshop.imageUrls && workshop.imageUrls.length > 0
        ? workshop.imageUrls.map(normalizePlaceholderImage)
        : [DEFAULT_PLACEHOLDER_IMAGE],
    toolIds: []
  };
}

function mapWorkshopSlot(slot: BackendWorkshopTimeslot): WorkshopSlot {
  return {
    id: slot.id,
    workshopId: slot.workshopId,
    startIso: toLocalDateTimeInputValue(slot.startTime),
    endIso: toLocalDateTimeInputValue(slot.endTime),
    blockedByOwner: Boolean(slot.blockedByOwner)
  };
}

function mapWorkshopBookedRanges(bookings?: BackendWorkshopBookedRange[]): WorkshopBookedRange[] {
  return (bookings ?? []).map((booking) => ({
    startIso: booking.startDate,
    endIso: booking.endDate
  }));
}

function mapPickupProposal(p: BackendPickupProposal): PickupProposal {
  return {
    id: p.id,
    proposedById: p.proposedByUserId,
    proposedPickupIso: p.proposedPickupTime,
    proposedReturnIso: p.proposedReturnTime ?? undefined,
    previousPickupIso: p.previousPickupTime ?? undefined,
    previousReturnIso: p.previousReturnTime ?? undefined,
    status: p.status,
    createdIso: p.createdAt
  };
}

function mapTimeslotProposal(p: BackendTimeslotProposal): TimeslotProposal {
  return {
    id: p.id,
    proposedById: p.proposedByUserId,
    proposedStartIso: p.proposedStartDate,
    proposedEndIso: p.proposedEndDate,
    previousStartIso: p.previousStartDate ?? undefined,
    previousEndIso: p.previousEndDate ?? undefined,
    status: p.status,
    createdIso: p.createdAt
  };
}

function mapPublicRating(rating: BackendRating): PublicRating {
  return {
    id: rating.id,
    score: rating.score,
    comment: rating.comment ?? undefined,
    createdIso: rating.createdAt,
    fromUserName: rating.fromUser?.name
  };
}

function mapRating(rating: BackendRating): Rating {
  const tool = rating.booking?.tool;
  const workshop = rating.booking?.timeslot?.workshop;
  return {
    id: rating.id,
    bookingId: rating.bookingId,
    fromUserId: rating.fromUserId,
    toUserId: rating.toUserId,
    score: rating.score,
    comment: rating.comment ?? undefined,
    status: rating.status === "HIDDEN" ? "AUSGEBLENDET" : "SICHTBAR",
    createdIso: rating.createdAt,
    fromUserName: rating.fromUser?.name,
    listingLabel: tool?.name ?? workshop?.name,
    listingType: tool ? "TOOL" : workshop ? "WORKSHOP" : undefined
  };
}

function mapBooking(booking: BackendBooking): Booking {
  const tool = booking.tool;
  const workshop = booking.workshop ?? booking.timeslot?.workshop;

  const providerId = tool?.ownerId ?? workshop?.managerId ?? "";
  const requesterName = booking.user?.name;
  const providerName = tool?.owner?.name ?? workshop?.manager?.name;

  let toolName: string | undefined;
  let toolImageUrl: string | undefined;
  if (tool) {
    toolName = tool.name;
    toolImageUrl = tool.imageUrl ?? undefined;
  } else if (workshop) {
    toolName = workshop.name;
  }

  const selectedWorkshopTools: BookingSelectedTool[] = (booking.selectedTools ?? []).map((selected) => ({
    id: selected.workshopTool.id,
    name: selected.workshopTool.name,
    category: selected.workshopTool.category
  }));

  return {
    id: booking.id,
    type: booking.toolId ? "TOOL" : "WORKSHOP",
    requesterId: booking.userId,
    providerId,
    toolId: booking.toolId ?? undefined,
    workshopId: workshop?.id,
    slotId: booking.timeslotId ?? undefined,
    startIso: booking.startDate,
    endIso: booking.endDate,
    pickupTimeIso: booking.pickupTime ?? undefined,
    status: bookingStatusMap[booking.status],
    createdIso: booking.createdAt ?? booking.startDate,
    requesterName,
    providerName,
    toolName,
    toolImageUrl,
    pickupProposals: (booking.pickupProposals ?? []).map(mapPickupProposal),
    timeslotProposals: (booking.timeslotProposals ?? []).map(mapTimeslotProposal),
    selectedWorkshopTools
  };
}

export {
  mapTool,
  mapWorkshop,
  mapWorkshopSlot,
  mapWorkshopBookedRanges,
  mapPickupProposal,
  mapTimeslotProposal,
  mapPublicRating,
  mapRating,
  mapBooking
};
