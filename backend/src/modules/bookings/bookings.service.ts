import { AppError } from "../../utils/app-error";
import { bookingsRepository } from "./bookings.repository";
import { notificationsRepository } from "../notifications/notifications.repository";

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
    const tool = await bookingsRepository.findToolById(input.toolId);
    if (!tool) {
      throw new AppError("TOOL_NOT_FOUND", "Tool not found", 404);
    }

    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    const pickupTime = new Date(input.pickupTime);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate >= endDate) {
      throw new AppError("INVALID_TIME_RANGE", "Invalid booking time range", 400);
    }

    const overlap = await bookingsRepository.findOverlappingToolBooking(tool.id, startDate, endDate);
    if (overlap) {
      throw new AppError(
        "BOOKING_CONFLICT",
        "This tool is unavailable in the selected period",
        409
      );
    }

    const booking = await bookingsRepository.createToolBooking({
      userId: input.requesterId,
      toolId: tool.id,
      startDate,
      endDate,
      pickupTime
    });

    await notificationsRepository.create(tool.ownerId, "Neue Ausleihanfrage fuer dein Werkzeug.");
    return booking;
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
      throw new AppError("BOOKING_CONFLICT", "Timeslot is already booked", 409);
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

    const isToolOwner = booking.tool?.ownerId === input.actorId;
    const isModeratorOrManager = input.actorRole === "MODERATOR" || input.actorRole === "MANAGER";
    if (!isToolOwner && !isModeratorOrManager) {
      throw new AppError("FORBIDDEN", "Only owner or moderation roles can update booking", 403);
    }

    const updated = await bookingsRepository.updateStatus(input.bookingId, input.status);
    await notificationsRepository.create(booking.userId, `Deine Buchung wurde auf ${input.status} gesetzt.`);
    return updated;
  }
};
