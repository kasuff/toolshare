import { AppError } from "../../utils/app-error";
import { workshopsRepository } from "./workshops.repository";

export const workshopsService = {
  list(filters: { managerId?: string; location?: string; search?: string }) {
    return workshopsRepository.list(filters);
  },

  async getById(id: string) {
    const workshop = await workshopsRepository.findById(id);
    if (!workshop) {
      throw new AppError("WORKSHOP_NOT_FOUND", "Workshop not found", 404);
    }
    return workshop;
  },

  create(input: {
    managerId: string;
    name: string;
    description: string;
    location: string;
    maxCapacity: number;
  }) {
    return workshopsRepository.create(input);
  },

  async update(input: {
    workshopId: string;
    managerId: string;
    data: {
      name?: string;
      description?: string;
      location?: string;
      maxCapacity?: number;
    };
  }) {
    const workshop = await workshopsRepository.findById(input.workshopId);
    if (!workshop) {
      throw new AppError("WORKSHOP_NOT_FOUND", "Workshop not found", 404);
    }
    if (workshop.managerId !== input.managerId) {
      throw new AppError("FORBIDDEN", "Only the workshop manager can update this workshop", 403);
    }

    return workshopsRepository.update(input.workshopId, input.data);
  },

  async remove(input: { workshopId: string; managerId: string }) {
    const workshop = await workshopsRepository.findById(input.workshopId);
    if (!workshop) {
      throw new AppError("WORKSHOP_NOT_FOUND", "Workshop not found", 404);
    }
    if (workshop.managerId !== input.managerId) {
      throw new AppError("FORBIDDEN", "Only the workshop manager can delete this workshop", 403);
    }

    await workshopsRepository.remove(input.workshopId);
  },

  async createTimeslot(input: {
    workshopId: string;
    managerId: string;
    startTime: string;
    endTime: string;
  }) {
    const workshop = await workshopsRepository.findById(input.workshopId);
    if (!workshop) {
      throw new AppError("WORKSHOP_NOT_FOUND", "Workshop not found", 404);
    }
    if (workshop.managerId !== input.managerId) {
      throw new AppError("FORBIDDEN", "Only the workshop manager can manage timeslots", 403);
    }

    const startTime = new Date(input.startTime);
    const endTime = new Date(input.endTime);
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || startTime >= endTime) {
      throw new AppError("INVALID_TIME_RANGE", "Invalid timeslot range", 400);
    }

    const overlap = await workshopsRepository.findOverlappingTimeslot(
      input.workshopId,
      startTime,
      endTime
    );
    if (overlap) {
      throw new AppError("TIMESLOT_CONFLICT", "Timeslot overlaps with an existing slot", 409);
    }

    return workshopsRepository.createTimeslot({
      workshopId: input.workshopId,
      startTime,
      endTime
    });
  },

  async removeTimeslot(input: { workshopId: string; timeslotId: string; managerId: string }) {
    const timeslot = await workshopsRepository.findTimeslotById(input.timeslotId);
    if (!timeslot || timeslot.workshopId !== input.workshopId) {
      throw new AppError("TIMESLOT_NOT_FOUND", "Timeslot not found", 404);
    }
    if (timeslot.workshop.managerId !== input.managerId) {
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