import type {
  BookingPickupProposalResponse,
  BookingResponse,
  BookingTimeslotProposalResponse
} from "@toolshare/shared/contracts/response/bookings.schema";
import type {
  BookingEntity,
  BookingPickupProposalEntity,
  BookingTimeslotProposalEntity,
  UserRefEntity
} from "./bookings.entity";

// Akzeptiert Date (Produktion/Prisma) oder bereits serialisierte Strings (Testdoubles).
const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : String(value);
const isoOrNull = (value: Date | string | null | undefined): string | null =>
  value == null ? null : value instanceof Date ? value.toISOString() : String(value);

function userRef(user?: UserRefEntity | null) {
  if (!user) return undefined;
  return { id: user.id, name: user.name };
}

export function toBookingPickupProposalResponse(
  proposal: BookingPickupProposalEntity
): BookingPickupProposalResponse {
  return {
    id: proposal.id,
    bookingId: proposal.bookingId,
    proposedByUserId: proposal.proposedByUserId,
    proposedPickupTime: iso(proposal.proposedPickupTime),
    proposedReturnTime: isoOrNull(proposal.proposedReturnTime),
    previousPickupTime: isoOrNull(proposal.previousPickupTime),
    previousReturnTime: isoOrNull(proposal.previousReturnTime),
    status: proposal.status,
    createdAt: iso(proposal.createdAt)
  };
}

export function toBookingTimeslotProposalResponse(
  proposal: BookingTimeslotProposalEntity
): BookingTimeslotProposalResponse {
  return {
    id: proposal.id,
    bookingId: proposal.bookingId,
    proposedByUserId: proposal.proposedByUserId,
    proposedStartDate: iso(proposal.proposedStartDate),
    proposedEndDate: iso(proposal.proposedEndDate),
    previousStartDate: isoOrNull(proposal.previousStartDate),
    previousEndDate: isoOrNull(proposal.previousEndDate),
    status: proposal.status,
    createdAt: iso(proposal.createdAt)
  };
}

export function toBookingResponse(booking: BookingEntity): BookingResponse {
  return {
    id: booking.id,
    userId: booking.userId,
    toolId: booking.toolId ?? null,
    timeslotId: booking.timeslotId ?? null,
    workshopId: booking.workshopId ?? null,
    startDate: iso(booking.startDate),
    endDate: iso(booking.endDate),
    pickupTime: isoOrNull(booking.pickupTime),
    createdAt: booking.createdAt ? iso(booking.createdAt) : undefined,
    status: booking.status,
    user: userRef(booking.user),
    tool: booking.tool
      ? {
          id: booking.tool.id,
          ownerId: booking.tool.ownerId,
          name: booking.tool.name,
          imageUrl: booking.tool.imageUrl ?? null,
          owner: userRef(booking.tool.owner)
        }
      : undefined,
    workshop: booking.workshop
      ? {
          id: booking.workshop.id,
          name: booking.workshop.name,
          managerId: booking.workshop.managerId,
          manager: userRef(booking.workshop.manager)
        }
      : undefined,
    timeslot: booking.timeslot
      ? {
          id: booking.timeslot.id,
          workshopId: booking.timeslot.workshopId,
          startTime: iso(booking.timeslot.startTime),
          endTime: iso(booking.timeslot.endTime),
          workshop: booking.timeslot.workshop
            ? {
                id: booking.timeslot.workshop.id,
                name: booking.timeslot.workshop.name,
                managerId: booking.timeslot.workshop.managerId,
                manager: userRef(booking.timeslot.workshop.manager)
              }
            : undefined
        }
      : undefined,
    selectedTools: booking.selectedTools?.map((selected) => ({
      workshopToolId: selected.workshopToolId,
      workshopTool: {
        id: selected.workshopTool.id,
        name: selected.workshopTool.name,
        category: selected.workshopTool.category
      }
    })),
    pickupProposals: booking.pickupProposals?.map(toBookingPickupProposalResponse),
    timeslotProposals: booking.timeslotProposals?.map(toBookingTimeslotProposalResponse)
  };
}

export function toBookingResponseList(bookings: BookingEntity[]): BookingResponse[] {
  return bookings.map(toBookingResponse);
}
