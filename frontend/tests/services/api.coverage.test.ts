import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../src/services/api";

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

function responseJson(body: unknown, init?: ResponseInit) {
  const status = init?.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as Response;
}

function responseNoContent(status = 204) {
  return {
    ok: true,
    status,
    json: async () => undefined
  } as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe("api coverage", () => {
  it("maps auth and user endpoints", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);

      if (url.endsWith("/auth/login")) {
        return responseJson({
          user: { id: "u1", email: "lea@example.com", name: "Lea", address: "Straße 1", role: "USER", isSuspended: false },
          accessToken: "login-token",
          refreshToken: "refresh-token"
        });
      }

      if (url.endsWith("/auth/register")) {
        return responseJson({
          user: { id: "u2", email: "nina@example.com", name: "Nina", address: "Straße 2", role: "MODERATOR", isSuspended: false },
          accessToken: "register-token",
          refreshToken: "refresh-token"
        });
      }

      if (url.endsWith("/users/me") && init?.method === "PATCH") {
        return responseJson({ id: "u1", email: "lea@example.com", name: "Lea Neu", address: "Muster 3", role: "MODERATOR", isSuspended: true });
      }

      if (url.endsWith("/users/me")) {
        return responseJson({ id: "u1", email: "lea@example.com", name: "Lea", address: "Straße 1", role: "MANAGER", isSuspended: false });
      }

      if (url.includes("/users?")) {
        return responseJson([{ id: "u3", email: "bob@example.com", name: "Bob", role: "USER", isSuspended: false }]);
      }

      if (url.endsWith("/users/u1/role") || url.endsWith("/users/u1/suspension")) {
        return responseNoContent();
      }

      throw new Error(`Unexpected request ${url}`);
    });

    await expect(api.login("lea@example.com", "password123")).resolves.toMatchObject({
      accessToken: "login-token"
    });
    await expect(api.register({ email: "nina@example.com", password: "password123", name: "Nina", address: "Straße 2" })).resolves.toMatchObject({
      accessToken: "register-token"
    });
    await expect(api.getCurrentUser("token-123")).resolves.toMatchObject({
      id: "u1",
      role: "ADMIN",
      isSuspended: false
    });

    const users = await api.listUsers("token-123", { search: "lea", role: "ADMIN" });
    expect(users).toEqual([
      expect.objectContaining({ id: "u3", name: "Bob", role: "NUTZER" })
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/users?search=lea&role=MANAGER",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-123" })
      })
    );

    await api.updateUserRole("u1", "MODERATOR", "token-123");
    await api.updateUserSuspension("u1", true, "token-123");

    await expect(api.updateMyProfile({ name: "Lea Neu" }, "token-123")).resolves.toMatchObject({
      name: "Lea Neu",
      role: "MODERATOR",
      isSuspended: true
    });
  });

  it("maps tools, workshops and booking payloads", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);

      if (url.includes("/tools?") && init?.method !== "POST") {
        return responseJson([
          {
            id: "t1",
            ownerId: "u2",
            name: "Akkuschrauber",
            description: "Mit Koffer",
            category: "Bohrmaschine",
            imageUrl: null,
            status: "AVAILABLE"
          }
        ]);
      }

      if (url.endsWith("/tools") && init?.method === "POST") {
        return responseJson({
          id: "t2",
          ownerId: "u2",
          name: "Bohrhammer",
          description: "Für Beton",
          category: "Bau",
          imageUrl: null,
          status: "REQUESTED"
        });
      }

      if (url.includes("/workshops?") && init?.method !== "POST") {
        return responseJson([
          {
            id: "w1",
            managerId: "u2",
            name: "Maker Space",
            description: "Mit Tisch",
            location: "Muenchen",
            maxCapacity: 6,
            extras: ["wlan"],
            imageUrls: [],
            workshopTools: [{ id: "wt1", name: "Bohrmaschine", category: "holz" }],
            timeslots: [
              { id: "s1", workshopId: "w1", startTime: "2026-05-06T10:00:00.000Z", endTime: "2026-05-06T12:00:00.000Z" }
            ]
          }
        ]);
      }

      if (url.endsWith("/workshops/w1")) {
        return responseJson({
          id: "w1",
          managerId: "u2",
          name: "Maker Space",
          description: "Mit Tisch",
          location: "Muenchen",
          maxCapacity: 6,
          equipment: ["wlan"],
          imageUrls: ["workshop.png"],
          workshopTools: [{ id: "wt1", name: "Bohrmaschine", category: "holz" }],
          timeslots: [
            { id: "s1", workshopId: "w1", startTime: "2026-05-06T10:00:00.000Z", endTime: "2026-05-06T12:00:00.000Z", blockedByOwner: true }
          ]
        });
      }

      if (url.endsWith("/workshops") && init?.method === "POST") {
        return responseJson({
          id: "w2",
          managerId: "u2",
          name: "Neuer Raum",
          description: "Neu",
          location: "Berlin",
          maxCapacity: 4,
          extras: [],
          imageUrls: [],
          workshopTools: []
        });
      }

      if (url.endsWith("/workshops/w2/timeslots") && init?.method === "POST") {
        return responseJson({
          id: `slot-${Math.random().toString(16).slice(2, 6)}`,
          workshopId: "w2",
          startTime: "2026-05-07T08:00:00.000Z",
          endTime: "2026-05-07T10:00:00.000Z",
          blockedByOwner: false
        });
      }

      if (url.endsWith("/workshops/w2/timeslots/s1") && init?.method === "PATCH") {
        return responseJson({
          id: "s1",
          workshopId: "w2",
          startTime: "2026-05-07T09:00:00.000Z",
          endTime: "2026-05-07T11:00:00.000Z",
          blockedByOwner: true
        });
      }

      if (url.endsWith("/workshops/w2/timeslots/s1") && init?.method === "DELETE") {
        return responseNoContent();
      }

      if (url.endsWith("/bookings/tool") && init?.method === "POST") {
        return responseJson({
          id: "b1",
          userId: "u1",
          toolId: "t1",
          startDate: "2026-05-06T10:00:00.000Z",
          endDate: "2026-05-06T12:00:00.000Z",
          pickupTime: "2026-05-06T09:00:00.000Z",
          status: "PENDING",
          tool: { ownerId: "u2", name: "Akkuschrauber", imageUrl: null, status: "AVAILABLE" }
        });
      }

      if (url.endsWith("/bookings/workshop") && init?.method === "POST") {
        return responseJson({
          id: "b2",
          userId: "u1",
          timeslotId: "s1",
          startDate: "2026-05-08T08:00:00.000Z",
          endDate: "2026-05-08T10:00:00.000Z",
          status: "ACCEPTED",
          timeslot: {
            id: "s1",
            workshopId: "w1",
            startTime: "2026-05-08T08:00:00.000Z",
            endTime: "2026-05-08T10:00:00.000Z",
            workshop: { id: "w1", name: "Maker Space", managerId: "u2" }
          }
        });
      }

      if (url.endsWith("/bookings/me")) {
        return responseJson([
          {
            id: "b3",
            userId: "u1",
            toolId: "t1",
            startDate: "2026-05-09T08:00:00.000Z",
            endDate: "2026-05-09T10:00:00.000Z",
            pickupTime: null,
            status: "RETURNED",
            tool: { ownerId: "u2", name: "Akkuschrauber", imageUrl: null, status: "AVAILABLE" }
          }
        ]);
      }

      if (url.endsWith("/bookings/b1/status") || url.endsWith("/bookings/b1/pickup-proposals") || url.endsWith("/bookings/b1/pickup-proposals/p1")) {
        return responseNoContent();
      }

      if (url.endsWith("/notifications/me")) {
        return responseJson([{ id: "n1", userId: "u1", message: "Hallo", read: false, createdAt: "2026-05-05T10:00:00.000Z" }]);
      }

      if (url.endsWith("/moderation/reports")) {
        return responseJson([{ id: "r1", reason: "Defekt", status: "OPEN" }]);
      }

      if (url.endsWith("/moderation/reports/r1") && init?.method === "PATCH") {
        return responseNoContent();
      }

      if (url.endsWith("/ratings/me/received")) {
        return responseJson([{ id: "rt1", score: 5, createdAt: "2026-05-05T12:00:00.000Z", fromUser: { name: "Lea" } }]);
      }

      if (url.endsWith("/users/admin/metrics")) {
        return responseJson({ users: 7, tools: 4, workshops: 2, openBookings: 1, openReports: 0 });
      }

      throw new Error(`Unexpected request ${url}`);
    });

    const tools = await api.getTools({ q: "bohr", category: "holz" }, "token-123");
    expect(tools[0]).toMatchObject({
      id: "t1",
      ownerId: "u2",
      status: "VERFUEGBAR",
      imageUrl: expect.any(String)
    });

    const createdTool = await api.createTool({ name: "Bohrhammer", description: "Für Beton", category: "bau" }, "token-123");
    expect(createdTool).toMatchObject({
      id: "t2",
      status: "AUSGELIEHEN"
    });

    const workshops = await api.getWorkshops({ q: "maker" }, "token-123");
    expect(workshops[0].workshop).toMatchObject({
      id: "w1",
      ownerId: "u2"
    });
    expect(workshops[0].workshop.imageUrls[0]).toContain("data:image/svg+xml;charset=UTF-8,");
    expect(workshops[0].slots[0]).toMatchObject({ id: "s1" });
    expect(workshops[0].slots[0].blockedByOwner).toBe(true);
    expect(workshops[0].slots[0].startIso).toMatch(/^2026-05-06T/);

    const detail = await api.getWorkshopById("w1", "token-123");
    expect(detail.workshop.extras).toEqual(["wlan"]);
    expect(detail.slots[0]).toMatchObject({ blockedByOwner: true });

    const createdWorkshop = await api.createWorkshop(
      {
        name: "Neuer Raum",
        description: "Neu",
        location: "Berlin",
        maxCapacity: 4,
        extras: ["wlan"],
        equipmentItems: [{ name: "Säge", category: "holz" }],
        imageUrls: ["photo.png"],
        slots: [{ startIso: "2026-05-07T08:00:00.000Z", endIso: "2026-05-07T10:00:00.000Z", blockedByOwner: false }]
      },
      "token-123"
    );
    expect(createdWorkshop).toMatchObject({ id: "w2", ownerId: "u2" });

    const createdSlot = await api.createWorkshopTimeslot(
      "w2",
      { startIso: "2026-05-07T08:00:00.000Z", endIso: "2026-05-07T10:00:00.000Z", blockedByOwner: false },
      "token-123"
    );
    expect(createdSlot).toMatchObject({ workshopId: "w2", blockedByOwner: false });

    const updatedSlot = await api.updateWorkshopTimeslot(
      "w2",
      "s1",
      { startIso: "2026-05-07T09:00:00.000Z", endIso: "2026-05-07T11:00:00.000Z", blockedByOwner: true },
      "token-123"
    );
    expect(updatedSlot).toMatchObject({ id: "s1", blockedByOwner: true });
    expect(updatedSlot.startIso).toMatch(/^2026-05-07T/);
    await api.deleteWorkshopTimeslot("w2", "s1", "token-123");

    const toolBooking = await api.createToolRequest(
      { toolId: "t1", startIso: "2026-05-06T10:00:00.000Z", endIso: "2026-05-06T12:00:00.000Z", pickupTimeIso: "2026-05-06T09:00:00.000Z" },
      "token-123"
    );
    expect(toolBooking).toMatchObject({
      type: "TOOL",
      providerId: "u2",
      requesterName: undefined,
      providerName: undefined
    });

    const workshopBooking = await api.createWorkshopBooking({ slotId: "s1" }, "token-123");
    expect(workshopBooking).toMatchObject({
      type: "WORKSHOP",
      providerId: "u2",
      workshopId: "w1"
    });

    const bookings = await api.getBookingsForUser("token-123");
    expect(bookings[0]).toMatchObject({ id: "b3", status: "ABGESCHLOSSEN", type: "TOOL" });

    await api.decideBooking("b1", "BESTAETIGT", "token-123");
    await api.createPickupProposal("b1", "2026-05-06T13:00:00.000Z", "token-123");
    await api.respondPickupProposal("b1", "p1", "DECLINE", "token-123");

    const notifications = await api.getNotifications("token-123");
    expect(notifications[0]).toMatchObject({ id: "n1", createdIso: "2026-05-05T10:00:00.000Z" });

    const reports = await api.listReports("token-123");
    expect(reports).toEqual([expect.objectContaining({ id: "r1", status: "OPEN" })]);
    await api.updateReportStatus("r1", "RESOLVED", "token-123");

    const ratings = await api.getRatingsReceived("token-123");
    expect(ratings[0]).toMatchObject({ id: "rt1", score: 5, fromUser: { name: "Lea" } });

    expect(await api.getMetrics("token-123")).toMatchObject({
      users: 7,
      tools: 4,
      workshops: 2,
      openBookings: 1,
      openReports: 0
    });
  });

  it("surfaces validation and network failures", async () => {
    fetchMock.mockResolvedValueOnce(
      responseJson(
        {
          error: {
            code: "EMAIL_ALREADY_EXISTS",
            message: "duplicate"
          }
        },
        { status: 400 }
      )
    );
    await expect(api.createTool({ name: "X", description: "Test", category: "bau" }, "token-123")).rejects.toThrow(
      "Diese E-Mail ist bereits registriert."
    );

    fetchMock.mockResolvedValueOnce(
      responseJson(
        {
          error: {
            details: {
              fieldErrors: {
                body: ["at least 8 character"]
              }
            }
          }
        },
        { status: 400 }
      )
    );
    await expect(api.login("lea@example.com", "short")).rejects.toThrow("Passwort muss mindestens 8 Zeichen lang sein.");

    fetchMock.mockResolvedValueOnce(
      responseJson(
        {
          error: {
            details: {
              fieldErrors: {
                name: ["at least 3 character"]
              }
            }
          }
        },
        { status: 400 }
      )
    );
    await expect(api.createTool({ name: "X", description: "Test", category: "bau" }, "token-123")).rejects.toThrow(
      "name: Muss mindestens 3 Zeichen lang sein."
    );

    fetchMock.mockResolvedValueOnce(
      responseJson(
        {
          error: {
            details: {
              formErrors: ["Ungültiges Formular"]
            }
          }
        },
        { status: 400 }
      )
    );
    await expect(api.register({ email: "lea@example.com", password: "password123", name: "Lea", address: "Straße 1" })).rejects.toThrow(
      "Ungültiges Formular"
    );

    await expect(api.suggestAddresses("ab")).resolves.toEqual([]);
    await expect(api.validateAddress("abc")).resolves.toEqual({ isValid: false, normalizedAddress: null, normalizedParts: null });

    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(api.validateAddress("Musterstraße 1")).resolves.toEqual({
      isValid: true,
      normalizedAddress: null,
      normalizedParts: null
    });

    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(api.getMetrics("token-123")).rejects.toThrow("Netzwerkfehler: Bitte Verbindung prüfen und erneut versuchen.");

    await expect(api.createPickupProposal("b1", "not-a-date", "token-123")).rejects.toThrow("Ungültige Abholzeit.");
  });
});