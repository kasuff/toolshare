import { beforeEach, describe, expect, it } from "vitest";
import { api } from "../../src/services/mockApi";
import { resetDb } from "../../src/services/storage";

describe("mockApi", () => {
  beforeEach(() => {
    resetDb();
  });

  it("updates user state, rules and metrics", () => {
    expect(api.getUsers()).toHaveLength(5);

    api.updateUserRole("u1", "MODERATOR");
    api.toggleUserSuspended("u1");
    api.updateRule("r1", "Werkzeuge müssen sauber zurückgegeben werden.");

    expect(api.getUsers().find((user) => user.id === "u1")).toMatchObject({
      role: "MODERATOR",
      isSuspended: true
    });
    expect(api.getRules().find((rule) => rule.id === "r1")?.text).toBe(
      "Werkzeuge müssen sauber zurückgegeben werden."
    );
    expect(api.getMetrics()).toMatchObject({
      users: 5,
      tools: 2,
      workshops: 1,
      openBookings: 0,
      openReports: 0
    });
  });

  it("filters tools and maps workshops with selectable tools", () => {
    const filteredTools = api.getTools({ q: "bosch" });
    expect(filteredTools).toHaveLength(1);
    expect(filteredTools[0]).toMatchObject({
      id: "t1",
      name: "Akkuschrauber Bosch"
    });

    const workshops = api.getWorkshops({ q: "keller", toolFilter: "säge" });
    expect(workshops).toHaveLength(1);
    expect(workshops[0].workshop).toMatchObject({
      id: "w1",
      ownerId: "u2",
      name: "Kellerwerkstatt Murat"
    });
    expect(workshops[0].tools).toEqual([
      expect.objectContaining({
        id: "t2",
        selectable: true
      })
    ]);

    const createdTool = api.createTool({
      ownerId: "u1",
      name: "Bohrhammer",
      description: "Für Beton",
      category: "Bau",
      imageUrl: "custom.png"
    });
    expect(createdTool).toMatchObject({
      id: expect.stringMatching(/^t_/),
      status: "VERFUEGBAR"
    });
  });

  it("handles tool request lifecycle and notifications", () => {
    const firstRequest = api.createToolRequest({
      requesterId: "u1",
      toolId: "t1",
      startIso: "2026-05-06T10:00:00.000Z",
      endIso: "2026-05-06T12:00:00.000Z",
      pickupTimeIso: "2026-05-06T09:00:00.000Z"
    });

    expect(firstRequest).toMatchObject({
      type: "TOOL",
      requesterId: "u1",
      providerId: "u3",
      toolId: "t1",
      status: "OFFEN"
    });

    const duplicateRequest = api.createToolRequest({
      requesterId: "u2",
      toolId: "t1",
      startIso: "2026-05-06T11:00:00.000Z",
      endIso: "2026-05-06T13:00:00.000Z",
      pickupTimeIso: "2026-05-06T08:30:00.000Z"
    });
    expect(duplicateRequest).toBeNull();

    expect(api.getNotifications("u3")).toHaveLength(1);
    expect(api.getBookingsForUser("u1")).toHaveLength(1);

    api.decideBooking(firstRequest!.id, "BESTAETIGT");
    expect(api.getTools({ q: "bosch" })[0].status).toBe("AUSGELIEHEN");

    api.suggestAlternativePickup(firstRequest!.id, "2026-05-06T13:00:00.000Z");
    expect(api.getBookingsForUser("u1")[0]).toMatchObject({
      altPickupTimeIso: "2026-05-06T13:00:00.000Z",
      status: "BESTAETIGT"
    });

    api.closeBooking(firstRequest!.id);
    expect(api.getBookingsForUser("u1")[0].status).toBe("ABGESCHLOSSEN");
    expect(api.getTools({ q: "bosch" })[0].status).toBe("VERFUEGBAR");
  });

  it("manages workshop bookings, reports and ratings", () => {
    const workshop = api.createWorkshop(
      {
        ownerId: "u2",
        name: "Maker Space",
        description: "Mit Lasercutter",
        location: "Muenchen",
        maxCapacity: 6,
        extras: ["wlan"],
        equipmentItems: [{ id: "ignored", name: "Bohrmaschine", category: "elektro" }],
        imageUrls: ["image.png"],
        toolIds: []
      },
      [
        { startIso: "2026-05-08T08:00:00.000Z", endIso: "2026-05-08T10:00:00.000Z", blockedByOwner: true },
        { startIso: "2026-05-08T10:00:00.000Z", endIso: "2026-05-08T12:00:00.000Z", blockedByOwner: false }
      ]
    );

    const mappedWorkshop = api.getWorkshops({ q: "maker" })[0];
    const blockedSlotId = mappedWorkshop.slots[0].id;
    const openSlotId = mappedWorkshop.slots[1].id;

    expect(workshop).toMatchObject({
      id: mappedWorkshop.workshop.id,
      ownerId: "u2",
      name: "Maker Space"
    });

    expect(api.createWorkshopBooking({ requesterId: "u1", workshopId: mappedWorkshop.workshop.id, slotId: blockedSlotId })).toBeNull();

    const booking = api.createWorkshopBooking({ requesterId: "u1", workshopId: mappedWorkshop.workshop.id, slotId: openSlotId });
    expect(booking).toMatchObject({
      type: "WORKSHOP",
      providerId: "u2",
      workshopId: mappedWorkshop.workshop.id,
      slotId: openSlotId
    });
    expect(api.createWorkshopBooking({ requesterId: "u3", workshopId: mappedWorkshop.workshop.id, slotId: openSlotId })).toBeNull();
    expect(api.getNotifications("u2")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: "Neue Werkstattbuchung für Maker Space" })
      ])
    );

    api.createReport({
      reporterId: "u1",
      targetType: "TOOL",
      targetId: "t1",
      reason: "Defekt"
    });
    const report = api.getReports()[0];
    expect(report).toMatchObject({ status: "OFFEN", reason: "Defekt" });
    api.resolveReport(report.id, "Geprüft");
    expect(api.getReports()[0]).toMatchObject({ status: "BEARBEITET", decisionNote: "Geprüft" });

    api.createRating({
      bookingId: booking!.id,
      fromUserId: "u1",
      toUserId: "u2",
      score: 5,
      comment: "Sehr gut"
    });
    const rating = api.getRatings()[0];
    expect(rating).toMatchObject({
      bookingId: booking!.id,
      status: "SICHTBAR"
    });
    api.moderateRating(rating.id);
    expect(api.getRatings()[0].status).toBe("AUSGEBLENDET");

    expect(api.getMetrics()).toMatchObject({
      users: 5,
      tools: 2,
      workshops: 2,
      openBookings: 1,
      openReports: 0
    });
  });
});