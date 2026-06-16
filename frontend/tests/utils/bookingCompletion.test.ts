import { describe, expect, it } from "vitest";
import { canProviderCompleteBooking } from "../../src/utils/bookingCompletion";

const now = new Date("2026-06-01T10:00:00.000Z").getTime();

describe("canProviderCompleteBooking", () => {
  it.each([
    {
      name: "returned tool owned by the current provider",
      booking: {
        type: "TOOL" as const,
        status: "BESTAETIGT" as const,
        providerId: "provider-1",
        endIso: "2026-07-01T10:00:00.000Z"
      },
      userId: "provider-1",
      expected: true
    },
    {
      name: "workshop after the usage period",
      booking: {
        type: "WORKSHOP" as const,
        status: "BESTAETIGT" as const,
        providerId: "provider-1",
        endIso: "2026-05-01T10:00:00.000Z"
      },
      userId: "provider-1",
      expected: true
    },
    {
      name: "workshop before the usage period ended",
      booking: {
        type: "WORKSHOP" as const,
        status: "BESTAETIGT" as const,
        providerId: "provider-1",
        endIso: "2026-07-01T10:00:00.000Z"
      },
      userId: "provider-1",
      expected: false
    },
    {
      name: "workshop without an end time",
      booking: {
        type: "WORKSHOP" as const,
        status: "BESTAETIGT" as const,
        providerId: "provider-1",
        endIso: undefined
      },
      userId: "provider-1",
      expected: false
    },
    {
      name: "confirmed booking opened by the requester",
      booking: {
        type: "TOOL" as const,
        status: "BESTAETIGT" as const,
        providerId: "provider-1",
        endIso: "2026-05-01T10:00:00.000Z"
      },
      userId: "requester-1",
      expected: false
    },
    {
      name: "already completed booking",
      booking: {
        type: "TOOL" as const,
        status: "ABGESCHLOSSEN" as const,
        providerId: "provider-1",
        endIso: "2026-05-01T10:00:00.000Z"
      },
      userId: "provider-1",
      expected: false
    }
  ])("returns $expected for $name", ({ booking, userId, expected }) => {
    expect(canProviderCompleteBooking(booking, userId, now)).toBe(expected);
  });
});
