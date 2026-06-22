import { describe, expect, it } from "vitest";
import { createToolBookingBodySchema } from "@toolshare/shared/contracts/request/bookings.schema";
import { problemDetailsSchema } from "@toolshare/shared/contracts/errors/problem.schema";

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
