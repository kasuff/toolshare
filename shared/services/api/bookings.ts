import type { Booking, BookingStatus } from "../../types/domain";
import { request, requestParsed } from "./client";
import { mapBooking } from "./mappers";
import { bookingStatusReverseMap } from "./mappers/roles";
import { bookingListResponseSchema } from "../../contracts/response/bookings.schema";

export const bookingsApi = {
  async getBookingsForUser(token: string): Promise<Booking[]> {
    const bookings = await requestParsed(bookingListResponseSchema, "/bookings/me", undefined, token);
    return bookings.map(mapBooking);
  },

  async decideBooking(bookingId: string, status: BookingStatus, token: string) {
    await request(
      `/bookings/${bookingId}/status`,
      { method: "PATCH", body: JSON.stringify({ status: bookingStatusReverseMap[status] }) },
      token
    );
  },

  async createPickupProposal(bookingId: string, pickupTimeIso: string, returnTimeIso: string, token: string) {
    const pickup = new Date(pickupTimeIso);
    const returnTime = new Date(returnTimeIso);
    if (Number.isNaN(pickup.getTime()) || Number.isNaN(returnTime.getTime()) || pickup >= returnTime) {
      throw new Error("Ungültiger Abhol- oder Rückgabezeitpunkt.");
    }
    await request(
      `/bookings/${bookingId}/pickup-proposals`,
      { method: "POST", body: JSON.stringify({ pickupTime: pickup.toISOString(), returnTime: returnTime.toISOString() }) },
      token
    );
  },

  async respondPickupProposal(bookingId: string, proposalId: string, decision: "ACCEPT" | "DECLINE", token: string) {
    await request(
      `/bookings/${bookingId}/pickup-proposals/${proposalId}`,
      { method: "PATCH", body: JSON.stringify({ decision }) },
      token
    );
  },

  async createTimeslotProposal(bookingId: string, startIso: string, endIso: string, token: string) {
    await request(
      `/bookings/${bookingId}/timeslot-proposals`,
      { method: "POST", body: JSON.stringify({ startDate: new Date(startIso).toISOString(), endDate: new Date(endIso).toISOString() }) },
      token
    );
  },

  async respondTimeslotProposal(bookingId: string, proposalId: string, decision: "ACCEPT" | "DECLINE", token: string) {
    await request(
      `/bookings/${bookingId}/timeslot-proposals/${proposalId}`,
      { method: "PATCH", body: JSON.stringify({ decision }) },
      token
    );
  }
};
