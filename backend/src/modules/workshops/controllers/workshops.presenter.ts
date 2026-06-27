import type {
  WorkshopResponse,
  WorkshopTimeslotResponse
} from "@toolshare/shared/contracts/response/workshops.schema";
import type { WorkshopEntity, WorkshopTimeslotEntity } from "../entities/workshops.entity";

const iso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : String(value);

export function toWorkshopTimeslotResponse(
  timeslot: WorkshopTimeslotEntity
): WorkshopTimeslotResponse {
  return {
    id: timeslot.id,
    workshopId: timeslot.workshopId,
    startTime: iso(timeslot.startTime),
    endTime: iso(timeslot.endTime),
    blockedByOwner: Boolean(timeslot.blockedByOwner)
  };
}

export function toWorkshopResponse(workshop: WorkshopEntity): WorkshopResponse {
  return {
    id: workshop.id,
    managerId: workshop.managerId,
    manager: workshop.manager
      ? {
          id: workshop.manager.id,
          name: workshop.manager.name,
          isSuspended: workshop.manager.isSuspended
        }
      : undefined,
    name: workshop.name,
    description: workshop.description,
    location: workshop.location,
    latitude: workshop.latitude ?? null,
    longitude: workshop.longitude ?? null,
    maxCapacity: workshop.maxCapacity,
    extras: workshop.extras ?? workshop.equipment ?? [],
    imageUrls: workshop.imageUrls ?? [],
    workshopTools: workshop.workshopTools?.map((tool) => ({
      id: tool.id,
      name: tool.name,
      category: tool.category
    })),
    timeslots: workshop.timeslots?.map(toWorkshopTimeslotResponse),
    bookings: workshop.bookings?.map((booking) => ({
      id: booking.id,
      startDate: iso(booking.startDate),
      endDate: iso(booking.endDate),
      status: booking.status
    }))
  };
}

export function toWorkshopResponseList(workshops: WorkshopEntity[]): WorkshopResponse[] {
  return workshops.map(toWorkshopResponse);
}