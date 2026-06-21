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

  it("treats window boundaries as inclusive and rejects invalid booking data", () => {
    const booking: Booking = {
      id: "b3",
      type: "WORKSHOP",
      requesterId: "u1",
      providerId: "u2",
      workshopId: "w1",
      startIso: "2026-06-15T10:00:00.000Z",
      endIso: "2026-06-15T14:00:00.000Z",
      status: "BESTAETIGT",
      createdIso: "2026-06-10T10:00:00.000Z"
    };

    expect(isActiveBooking(booking, new Date("2026-06-15T10:00:00.000Z").getTime())).toBe(true);
    expect(isActiveBooking(booking, new Date("2026-06-15T14:00:00.000Z").getTime())).toBe(true);
    expect(isActiveBooking(booking, new Date("2026-06-15T09:59:59.999Z").getTime())).toBe(false);
    expect(isActiveBooking(booking, new Date("2026-06-15T14:00:00.001Z").getTime())).toBe(false);

    expect(isActiveBooking({ ...booking, startIso: undefined }, now)).toBe(false);
    expect(isActiveBooking({ ...booking, endIso: undefined }, now)).toBe(false);
    expect(isActiveBooking({ ...booking, startIso: "not-a-date", endIso: "2026-06-15T14:00:00.000Z" }, now)).toBe(
      false
    );
    expect(isActiveBooking({ ...booking, startIso: "2026-06-15T10:00:00.000Z", endIso: "not-a-date" }, now)).toBe(false);
  });

  it("ignores non-workshop bookings when checking workshop use", () => {
    const toolBooking: Booking = {
      id: "b4",
      type: "TOOL",
      requesterId: "u1",
      providerId: "u2",
      toolId: "t1",
      startIso: "2026-06-15T10:00:00.000Z",
      endIso: "2026-06-15T14:00:00.000Z",
      status: "BESTAETIGT",
      createdIso: "2026-06-10T10:00:00.000Z"
    };

    expect(isWorkshopCurrentlyInUse("w1", [toolBooking], now)).toBe(false);
    expect(isWorkshopCurrentlyInUse("w1", [], now)).toBe(false);
  });

  it("maps tool and workshop badge labels", () => {
    expect(getToolStatusBadge("VERFUEGBAR")).toEqual({ label: "Verfügbar", unavailable: false });
    expect(getToolStatusBadge("AUSGELIEHEN")).toEqual({ label: "Ausgeliehen", unavailable: true });
    expect(getWorkshopStatusBadge(false)).toEqual({ label: "Frei", unavailable: false });
    expect(getWorkshopStatusBadge(true)).toEqual({ label: "In Nutzung", unavailable: true });
  });
});
