import { describe, expect, it } from "vitest";
import { createToolBookingBodySchema } from "@toolshare/shared/contracts/request/bookings.schema";
import {
  bookingResponseSchema,
  bookingPickupProposalResponseSchema
} from "@toolshare/shared/contracts/response/bookings.schema";
import { problemDetailsSchema } from "@toolshare/shared/contracts/errors/problem.schema";
import {
  toBookingResponse,
  toBookingPickupProposalResponse
} from "../../src/modules/bookings/controllers/bookings.presenter";
import type { BookingEntity, BookingPickupProposalEntity } from "../../src/modules/bookings/entities/bookings.entity";

const sampleBooking: BookingEntity = {
  id: "11111111-1111-1111-1111-111111111111",
  userId: "22222222-2222-2222-2222-222222222222",
  toolId: "33333333-3333-3333-3333-333333333333",
  timeslotId: null,
  workshopId: null,
  startDate: new Date("2026-07-01T10:00:00.000Z"),
  endDate: new Date("2026-07-01T14:00:00.000Z"),
  pickupTime: new Date("2026-07-01T09:30:00.000Z"),
  createdAt: new Date("2026-06-20T08:00:00.000Z"),
  status: "PENDING",
  user: { id: "22222222-2222-2222-2222-222222222222", name: "Lea" },
  tool: {
    id: "33333333-3333-3333-3333-333333333333",
    ownerId: "44444444-4444-4444-4444-444444444444",
    name: "Bohrer",
    imageUrl: null,
    owner: { id: "44444444-4444-4444-4444-444444444444", name: "Max" }
  },
  pickupProposals: [],
  timeslotProposals: []
};

const samplePickupProposal: BookingPickupProposalEntity = {
  id: "55555555-5555-5555-5555-555555555555",
  bookingId: "11111111-1111-1111-1111-111111111111",
  proposedByUserId: "44444444-4444-4444-4444-444444444444",
  proposedPickupTime: new Date("2026-07-02T09:00:00.000Z"),
  proposedReturnTime: new Date("2026-07-02T15:00:00.000Z"),
  previousPickupTime: null,
  previousReturnTime: null,
  status: "PENDING",
  createdAt: new Date("2026-06-21T08:00:00.000Z")
};

describe("bookings contracts", () => {
  it("accepts valid tool booking request bodies", () => {
    const parsed = createToolBookingBodySchema.parse({
      toolId: "11111111-1111-1111-1111-111111111111",
      startDate: "2026-07-01T10:00:00.000Z",
      endDate: "2026-07-01T14:00:00.000Z",
      pickupTime: "2026-07-01T09:30:00.000Z"
    });
    expect(parsed.toolId).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("rejects invalid tool booking bodies", () => {
    expect(() =>
      createToolBookingBodySchema.parse({
        toolId: "not-uuid",
        startDate: "2026-07-01T10:00:00.000Z",
        endDate: "2026-07-01T14:00:00.000Z",
        pickupTime: "2026-07-01T09:30:00.000Z"
      })
    ).toThrow();
  });

  it("booking presenter output matches bookingResponseSchema", () => {
    const response = toBookingResponse(sampleBooking);
    expect(() => bookingResponseSchema.parse(response)).not.toThrow();
  });

  it("pickup proposal presenter output matches schema", () => {
    const response = toBookingPickupProposalResponse(samplePickupProposal);
    expect(() => bookingPickupProposalResponseSchema.parse(response)).not.toThrow();
  });

  it("presenter never leaks sensitive user fields", () => {
    const response = toBookingResponse(sampleBooking);
    expect(JSON.stringify(response)).not.toContain("passwordHash");
    expect(response.user).toEqual({ id: sampleBooking.userId, name: "Lea" });
  });

  it("matches RFC 7807 booking conflict problem shape", () => {
    const problem = problemDetailsSchema.parse({
      type: "urn:toolshare:problem:booking_conflict",
      title: "BOOKING CONFLICT",
      status: 409,
      detail: "Im gewählten Zeitraum ist bereits eine Buchung vorhanden.",
      code: "BOOKING_CONFLICT"
    });
    expect(problem.code).toBe("BOOKING_CONFLICT");
  });
});