import { AppError } from "../../../utils/app-error";
import { getImageStorageService } from "../../../config/services";
import { resolveImageUrls } from "../../../ports/image-storage.service";
import { addressService } from "../../address/services/address.service";
import { workshopsRepository } from "../repositories/workshops.repository";

export const workshopsService = {
  async list(filters: { managerId?: string; location?: string; search?: string }) {
    const workshops = await workshopsRepository.list({
      ...filters,
      excludeSuspendedManagers: !filters.managerId
    });
    return workshops;
  },

  async getById(id: string) {
    const workshop = await workshopsRepository.findById(id);
    if (!workshop) {
      throw new AppError("WORKSHOP_NOT_FOUND", "Workshop not found", 404);
    }
    if (workshop.manager.isSuspended) {
      throw new AppError("WORKSHOP_NOT_FOUND", "Workshop not found", 404);
    }
    // Belegte Zeiträume separat laden, damit auch Altbuchungen via timeslotId
    // (nicht nur direkter workshopId-FK) im Kalender als belegt erscheinen.
    const bookings = await workshopsRepository.findActiveBookingRanges(id);
    return { ...workshop, bookings };
  },

  async create(input: {
    managerId: string;
    name: string;
    description: string;
    location: string;
    maxCapacity: number;
    extras?: string[];
    workshopTools?: Array<{ name: string; category: string }>;
    imageUrls?: string[];
  }) {
    const storage = getImageStorageService();
    const imageUrls = (await resolveImageUrls(storage, input.imageUrls)) ?? [];
    const coordinates = await addressService.geocode(input.location);
    const created = await workshopsRepository.create({
      ...input,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      extras: input.extras ?? [],
      workshopTools: input.workshopTools ?? [],
      imageUrls
    });
    return created;
  },

  async update(input: {
    workshopId: string;
    managerId: string;
    actorRole: "USER" | "MODERATOR" | "MANAGER";
    data: {
      name?: string;
      description?: string;
      location?: string;
      maxCapacity?: number;
      extras?: string[];
      workshopTools?: Array<{ name: string; category: string }>;
      imageUrls?: string[];
    };
  }) {
    const workshop = await workshopsRepository.findById(input.workshopId);
    if (!workshop) {
      throw new AppError("WORKSHOP_NOT_FOUND", "Workshop not found", 404);
    }
    const isOwner = workshop.managerId === input.managerId;
    const isManagerRole = input.actorRole === "MANAGER";
    if (!isOwner && !isManagerRole) {
      throw new AppError("FORBIDDEN", "Only the workshop manager can update this workshop", 403);
    }

    const storage = getImageStorageService();
    const imageUrls =
      input.data.imageUrls !== undefined
        ? (await resolveImageUrls(storage, input.data.imageUrls)) ?? []
        : undefined;

    const geo =
      input.data.location !== undefined ? await addressService.geocode(input.data.location) : null;

    const updated = await workshopsRepository.update(input.workshopId, {
      ...input.data,
      ...(imageUrls !== undefined ? { imageUrls } : {}),
      ...(input.data.location !== undefined
        ? { latitude: geo?.latitude ?? null, longitude: geo?.longitude ?? null }
        : {})
    });
    return updated;
  },

  async remove(input: {
    workshopId: string;
    managerId: string;
    actorRole: "USER" | "MODERATOR" | "MANAGER";
  }) {
    const workshop = await workshopsRepository.findById(input.workshopId);
    if (!workshop) {
      throw new AppError("WORKSHOP_NOT_FOUND", "Workshop not found", 404);
    }
    const isOwner = workshop.managerId === input.managerId;
    const isManagerOrModerator = input.actorRole === "MANAGER" || input.actorRole === "MODERATOR";
    if (!isOwner && !isManagerOrModerator) {
      throw new AppError("FORBIDDEN", "Only the workshop manager or moderation roles can delete this workshop", 403);
    }

    const activeBooking = await workshopsRepository.findActiveBooking(input.workshopId);
    if (activeBooking) {
      throw new AppError("ACTIVE_BOOKING_EXISTS", "Workshop has active bookings and cannot be deleted", 409);
    }

    await workshopsRepository.remove(input.workshopId);
  },

  async createTimeslot(input: {
    workshopId: string;
    managerId: string;
    actorRole: "USER" | "MODERATOR" | "MANAGER";
    startTime: string;
    endTime: string;
    blockedByOwner?: boolean;
  }) {
    const workshop = await workshopsRepository.findById(input.workshopId);
    if (!workshop) {
      throw new AppError("WORKSHOP_NOT_FOUND", "Workshop not found", 404);
    }
    const isOwner = workshop.managerId === input.managerId;
    const isManagerRole = input.actorRole === "MANAGER";
    if (!isOwner && !isManagerRole) {
      throw new AppError("FORBIDDEN", "Only the workshop manager can manage timeslots", 403);
    }

    const startTime = new Date(input.startTime);
    const endTime = new Date(input.endTime);
    const blockedByOwner = Boolean(input.blockedByOwner);
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || startTime >= endTime) {
      throw new AppError("INVALID_TIME_RANGE", "Invalid timeslot range", 400);
    }

    // Blocked intervals can be inserted into existing availability. Overlapping
    // free slots are split into remaining free segments around the block.
    if (blockedByOwner) {
      const blockedInsert = await workshopsRepository.createBlockedTimeslotWithAvailabilitySplit({
        workshopId: input.workshopId,
        startTime,
        endTime
      });

      if (blockedInsert === "BLOCKED_CONFLICT") {
        throw new AppError("TIMESLOT_CONFLICT", "Blocked timeslot overlaps with an existing blocked slot", 409);
      }
      if (blockedInsert === "ACTIVE_BOOKING_EXISTS") {
        throw new AppError("ACTIVE_BOOKING_EXISTS", "Affected timeslot has active bookings and cannot be blocked", 409);
      }

      return blockedInsert;
    }

    const overlap = await workshopsRepository.findOverlappingTimeslot(
      input.workshopId,
      startTime,
      endTime
    );
    if (overlap) {
      throw new AppError("TIMESLOT_CONFLICT", "Timeslot overlaps with an existing slot", 409);
    }

    const created = await workshopsRepository.createTimeslot({
      workshopId: input.workshopId,
      startTime,
      endTime,
      blockedByOwner
    });
    return created;
  },

  async updateTimeslot(input: {
    workshopId: string;
    timeslotId: string;
    managerId: string;
    actorRole: "USER" | "MODERATOR" | "MANAGER";
    startTime?: string;
    endTime?: string;
    blockedByOwner?: boolean;
  }) {
    const timeslot = await workshopsRepository.findTimeslotById(input.timeslotId);
    if (!timeslot || timeslot.workshopId !== input.workshopId) {
      throw new AppError("TIMESLOT_NOT_FOUND", "Timeslot not found", 404);
    }

    const isOwner = timeslot.workshop.managerId === input.managerId;
    const isManagerRole = input.actorRole === "MANAGER";
    if (!isOwner && !isManagerRole) {
      throw new AppError("FORBIDDEN", "Only the workshop manager can update timeslots", 403);
    }

    const hasTimeRangeChange = input.startTime !== undefined || input.endTime !== undefined;
    const becomesBlocked =
      input.blockedByOwner === true && timeslot.blockedByOwner === false;
    if (hasTimeRangeChange || becomesBlocked) {
      const booking = await workshopsRepository.findActiveBookingForTimeslot(input.timeslotId);
      if (booking) {
        throw new AppError(
          "ACTIVE_BOOKING_EXISTS",
          becomesBlocked
            ? "Timeslot has active bookings and cannot be blocked"
            : "Timeslot has active bookings and cannot change time range",
          409
        );
      }
    }

    const nextStart = input.startTime ? new Date(input.startTime) : timeslot.startTime;
    const nextEnd = input.endTime ? new Date(input.endTime) : timeslot.endTime;
    const nextBlockedByOwner = input.blockedByOwner ?? timeslot.blockedByOwner;

    if (Number.isNaN(nextStart.getTime()) || Number.isNaN(nextEnd.getTime()) || nextStart >= nextEnd) {
      throw new AppError("INVALID_TIME_RANGE", "Invalid timeslot range", 400);
    }

    if (!nextBlockedByOwner) {
      const overlap = await workshopsRepository.findOverlappingTimeslot(
        input.workshopId,
        nextStart,
        nextEnd,
        input.timeslotId
      );
      if (overlap) {
        throw new AppError("TIMESLOT_CONFLICT", "Timeslot overlaps with an existing slot", 409);
      }
    }

    const updated = await workshopsRepository.updateTimeslot(input.timeslotId, {
      startTime: input.startTime ? nextStart : undefined,
      endTime: input.endTime ? nextEnd : undefined,
      blockedByOwner: input.blockedByOwner
    });
    return updated;
  },

  async removeTimeslot(input: {
    workshopId: string;
    timeslotId: string;
    managerId: string;
    actorRole: "USER" | "MODERATOR" | "MANAGER";
  }) {
    const timeslot = await workshopsRepository.findTimeslotById(input.timeslotId);
    if (!timeslot || timeslot.workshopId !== input.workshopId) {
      throw new AppError("TIMESLOT_NOT_FOUND", "Timeslot not found", 404);
    }
    const isOwner = timeslot.workshop.managerId === input.managerId;
    const isManagerRole = input.actorRole === "MANAGER";
    if (!isOwner && !isManagerRole) {
      throw new AppError("FORBIDDEN", "Only the workshop manager can remove timeslots", 403);
    }

    const booking = await workshopsRepository.findActiveBookingForTimeslot(input.timeslotId);
    if (booking) {
      throw new AppError(
        "ACTIVE_BOOKING_EXISTS",
        "Timeslot has active bookings and cannot be removed",
        409
      );
    }

    await workshopsRepository.removeTimeslot(input.timeslotId);
  }
};