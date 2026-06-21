import { describe, expect, it } from "vitest";
import {
  getToolStatusBadge,
  getWorkshopStatusBadge,
  isActiveBooking,
  isWorkshopCurrentlyInUse
} from "../../src/utils/offerStatus";
import type { Booking } from "@toolshare/shared";

const now = new Date("2026-06-15T12:00:00.000Z").getTime();

describe("offerStatus", () => {
  it("detects an active confirmed booking in the current window", () => {
    const booking: Booking = {
      id: "b1",
      type: "WORKSHOP",
      requesterId: "u1",
      providerId: "u2",
      workshopId: "w1",
      startIso: "2026-06-15T10:00:00.000Z",
      endIso: "2026-06-15T14:00:00.000Z",
      status: "BESTAETIGT",
      createdIso: "2026-06-10T10:00:00.000Z"
    };

    expect(isActiveBooking(booking, now)).toBe(true);
    expect(isWorkshopCurrentlyInUse("w1", [booking], now)).toBe(true);
    expect(isWorkshopCurrentlyInUse("w2", [booking], now)).toBe(false);
  });

  it("ignores bookings outside the current window or with another status", () => {
    const booking: Booking = {
      id: "b2",
      type: "WORKSHOP",
      requesterId: "u1",
      providerId: "u2",
      workshopId: "w1",
      startIso: "2026-06-16T10:00:00.000Z",
      endIso: "2026-06-16T14:00:00.000Z",
      status: "BESTAETIGT",
      createdIso: "2026-06-10T10:00:00.000Z"
    };

    expect(isActiveBooking(booking, now)).toBe(false);

    const openBooking = { ...booking, status: "OFFEN" as const, startIso: "2026-06-15T10:00:00.000Z" };
    expect(isActiveBooking(openBooking, now)).toBe(false);
  });

  it("maps tool and workshop badge labels", () => {
    expect(getToolStatusBadge("VERFUEGBAR")).toEqual({ label: "Verfügbar", unavailable: false });
    expect(getToolStatusBadge("AUSGELIEHEN")).toEqual({ label: "Ausgeliehen", unavailable: true });
    expect(getWorkshopStatusBadge(false)).toEqual({ label: "Frei", unavailable: false });
    expect(getWorkshopStatusBadge(true)).toEqual({ label: "In Nutzung", unavailable: true });
  });
});
