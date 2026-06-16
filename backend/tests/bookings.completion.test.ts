import { describe, expect, it } from "vitest";
import { assertBookingCanBeCompleted } from "../src/modules/bookings/bookings.completion";

const past = new Date("2026-05-01T10:00:00.000Z");
const future = new Date("2026-07-01T10:00:00.000Z");
const now = new Date("2026-06-01T10:00:00.000Z").getTime();

describe("assertBookingCanBeCompleted", () => {
  it("allows the tool owner after the tool was returned, independent of the planned end", () => {
    expect(() =>
      assertBookingCanBeCompleted(
        {
          status: "ACCEPTED",
          endDate: future,
          tool: { ownerId: "owner-1" }
        },
        { actorId: "owner-1", actorRole: "USER" },
        now
      )
    ).not.toThrow();
  });

  it("allows the workshop provider after the usage period ended", () => {
    expect(() =>
      assertBookingCanBeCompleted(
        {
          status: "ACCEPTED",
          endDate: past,
          timeslot: { workshop: { managerId: "manager-1" } }
        },
        { actorId: "manager-1", actorRole: "USER" },
        now
      )
    ).not.toThrow();
  });

  it("allows moderation roles to complete an accepted booking", () => {
    expect(() =>
      assertBookingCanBeCompleted(
        {
          status: "ACCEPTED",
          endDate: past,
          tool: { ownerId: "owner-1" }
        },
        { actorId: "moderator-1", actorRole: "MODERATOR" },
        now
      )
    ).not.toThrow();
  });

  it("rejects actors who are neither provider nor moderation", () => {
    expect(() =>
      assertBookingCanBeCompleted(
        {
          status: "ACCEPTED",
          endDate: past,
          tool: { ownerId: "owner-1" }
        },
        { actorId: "requester-1", actorRole: "USER" },
        now
      )
    ).toThrowError(expect.objectContaining({ code: "FORBIDDEN", status: 403 }));
  });

  it("rejects completion unless the booking is accepted", () => {
    expect(() =>
      assertBookingCanBeCompleted(
        {
          status: "PENDING",
          endDate: past,
          tool: { ownerId: "owner-1" }
        },
        { actorId: "owner-1", actorRole: "USER" },
        now
      )
    ).toThrowError(expect.objectContaining({ code: "INVALID_STATE", status: 400 }));
  });

  it("rejects workshop completion before the usage period ended", () => {
    expect(() =>
      assertBookingCanBeCompleted(
        {
          status: "ACCEPTED",
          endDate: future,
          timeslot: { workshop: { managerId: "manager-1" } }
        },
        { actorId: "manager-1", actorRole: "USER" },
        now
      )
    ).toThrowError(expect.objectContaining({ code: "BOOKING_NOT_ENDED", status: 400 }));
  });
});
