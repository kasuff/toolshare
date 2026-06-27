import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, configureAuthSession } from "@toolshare/shared";

const fetchMock = vi.fn();

// Gültige UUIDs für schema-konforme Backend-Payloads (Response-Contracts erzwingen
// z.string().uuid()). URL-Routing nutzt weiterhin die kurzen Pfad-IDs.
const U = {
  u1: "11111111-1111-1111-1111-111111111111",
  u2: "22222222-2222-2222-2222-222222222222",
  u3: "33333333-3333-3333-3333-333333333333",
  t1: "aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  t2: "aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  w1: "bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  w2: "bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  s1: "ccccccc1-cccc-cccc-cccc-cccccccccccc",
  s2: "ccccccc2-cccc-cccc-cccc-cccccccccccc",
  wt1: "ddddddd1-dddd-dddd-dddd-dddddddddddd",
  b1: "eeeeeee1-eeee-eeee-eeee-eeeeeeeeeeee",
  b2: "eeeeeee2-eeee-eeee-eeee-eeeeeeeeeeee",
  b3: "eeeeeee3-eeee-eeee-eeee-eeeeeeeeeeee",
  n1: "fffffff1-ffff-ffff-ffff-ffffffffffff",
  r1: "1a1a1a1a-1a1a-1a1a-1a1a-1a1a1a1a1a1a",
  rt1: "2b2b2b2b-2b2b-2b2b-2b2b-2b2b2b2b2b2b"
} as const;

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
  vi.stubGlobal("fetch", fetchMock);
  // setup.ts imports authStore which calls configureAuthSession({ useCookieForRefresh: true })
  // as a module-level side effect. Reset to non-cookie mode so Bearer tokens are included.
  configureAuthSession({
    getAccessToken: () => null,
    getRefreshToken: () => null,
    setTokens: vi.fn(),
    clearTokens: vi.fn()
  });
});

describe("api coverage", () => {
  it("maps auth and user endpoints", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);

      if (url.endsWith("/auth/login")) {
        return responseJson({
          user: { id: U.u1, email: "lea@example.com", name: "Lea", address: "Straße 1", role: "USER", isSuspended: false },
          accessToken: "login-token",
          refreshToken: "refresh-token"
        });
      }

      if (url.endsWith("/auth/register")) {
        return responseJson({
          user: { id: U.u2, email: "nina@example.com", name: "Nina", address: "Straße 2", role: "MODERATOR", isSuspended: false },
          accessToken: "register-token",
          refreshToken: "refresh-token"
        });
      }

      if (url.endsWith("/users/me") && init?.method === "PATCH") {
        return responseJson({ id: U.u1, email: "lea@example.com", name: "Lea Neu", address: "Muster 3", role: "MODERATOR", isSuspended: true });
      }

      if (url.endsWith("/users/me")) {
        return responseJson({ id: U.u1, email: "lea@example.com", name: "Lea", address: "Straße 1", role: "MANAGER", isSuspended: false });
      }

      if (url.includes("/users?")) {
        return responseJson([{ id: U.u3, email: "bob@example.com", name: "Bob", address: "Straße 3", role: "USER", isSuspended: false }]);
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
      id: U.u1,
      role: "ADMIN",
      isSuspended: false
    });

    const users = await api.listUsers("token-123", { search: "lea", role: "ADMIN" });
    expect(users).toEqual([
      expect.objectContaining({ id: U.u3, name: "Bob", role: "NUTZER" })
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
            id: U.t1,
            ownerId: U.u2,
            name: "Akkuschrauber",
            description: "Mit Koffer",
            category: "Bohrmaschine",
            imageUrl: null,
            pickupLocation: "München",
            pickupLocationNote: null,
            status: "AVAILABLE",
            createdAt: "2026-05-01T10:00:00.000Z",
            updatedAt: "2026-05-01T10:00:00.000Z",
            owner: { id: U.u2, name: "Owner", role: "USER", isSuspended: false }
          }
        ]);
      }

      if (url.endsWith("/tools") && init?.method === "POST") {
        return responseJson({
          id: U.t2,
          ownerId: U.u2,
          name: "Bohrhammer",
          description: "Für Beton",
          category: "Bau",
          imageUrl: null,
          pickupLocation: "München",
          pickupLocationNote: null,
          status: "REQUESTED",
          createdAt: "2026-05-01T10:00:00.000Z",
          updatedAt: "2026-05-01T10:00:00.000Z",
          owner: { id: U.u2, name: "Owner", role: "USER", isSuspended: false }
        });
      }

      if (url.includes("/workshops?") && init?.method !== "POST") {
        return responseJson([
          {
            id: U.w1,
            managerId: U.u2,
            name: "Maker Space",
            description: "Mit Tisch",
            location: "Muenchen",
            maxCapacity: 6,
            extras: ["wlan"],
            imageUrls: [],
            workshopTools: [{ id: U.wt1, name: "Bohrmaschine", category: "holz" }],
            timeslots: [
              { id: U.s1, workshopId: U.w1, startTime: "2026-05-06T10:00:00.000Z", endTime: "2026-05-06T12:00:00.000Z", blockedByOwner: false }
            ]
          }
        ]);
      }

      if (url.endsWith(`/workshops/${U.w1}`)) {
        return responseJson({
          id: U.w1,
          managerId: U.u2,
          name: "Maker Space",
          description: "Mit Tisch",
          location: "Muenchen",
          maxCapacity: 6,
          extras: ["wlan"],
          imageUrls: ["workshop.png"],
          workshopTools: [{ id: U.wt1, name: "Bohrmaschine", category: "holz" }],
          timeslots: [
            { id: U.s1, workshopId: U.w1, startTime: "2026-05-06T10:00:00.000Z", endTime: "2026-05-06T12:00:00.000Z", blockedByOwner: true }
          ]
        });
      }

      if (url.endsWith("/workshops") && init?.method === "POST") {
        return responseJson({
          id: U.w2,
          managerId: U.u2,
          name: "Neuer Raum",
          description: "Neu",
          location: "Berlin",
          maxCapacity: 4,
          extras: [],
          imageUrls: [],
          workshopTools: []
        });
      }

      if (url.endsWith("/timeslots") && init?.method === "POST") {
        return responseJson({
          id: U.s2,
          workshopId: U.w2,
          startTime: "2026-05-07T08:00:00.000Z",
          endTime: "2026-05-07T10:00:00.000Z",
          blockedByOwner: false
        });
      }

      if (url.endsWith("/workshops/w2/timeslots/s1") && init?.method === "PATCH") {
        return responseJson({
          id: U.s1,
          workshopId: U.w2,
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
          id: U.b1,
          userId: U.u1,
          toolId: U.t1,
          startDate: "2026-05-06T10:00:00.000Z",
          endDate: "2026-05-06T12:00:00.000Z",
          pickupTime: "2026-05-06T09:00:00.000Z",
          status: "PENDING",
          tool: { id: U.t1, ownerId: U.u2, name: "Akkuschrauber", imageUrl: null }
        });
      }

      if (url.endsWith("/bookings/workshop") && init?.method === "POST") {
        return responseJson({
          id: U.b2,
          userId: U.u1,
          timeslotId: U.s1,
          workshopId: U.w1,
          startDate: "2026-05-08T08:00:00.000Z",
          endDate: "2026-05-08T10:00:00.000Z",
          status: "ACCEPTED",
          timeslot: {
            id: U.s1,
            workshopId: U.w1,
            startTime: "2026-05-08T08:00:00.000Z",
            endTime: "2026-05-08T10:00:00.000Z",
            workshop: { id: U.w1, name: "Maker Space", managerId: U.u2 }
          }
        });
      }

      if (url.endsWith("/bookings/me")) {
        return responseJson([
          {
            id: U.b3,
            userId: U.u1,
            toolId: U.t1,
            startDate: "2026-05-09T08:00:00.000Z",
            endDate: "2026-05-09T10:00:00.000Z",
            pickupTime: null,
            status: "RETURNED",
            tool: { id: U.t1, ownerId: U.u2, name: "Akkuschrauber", imageUrl: null }
          }
        ]);
      }

      if (url.endsWith("/bookings/b1/status") || url.endsWith("/bookings/b1/pickup-proposals") || url.endsWith("/bookings/b1/pickup-proposals/p1")) {
        return responseNoContent();
      }

      if (url.endsWith("/notifications/me")) {
        return responseJson([{ id: U.n1, userId: U.u1, message: "Hallo", read: false, createdAt: "2026-05-05T10:00:00.000Z" }]);
      }

      if (url.endsWith("/moderation/reports")) {
        return responseJson([
          {
            id: U.r1,
            reporterId: U.u3,
            reporterName: "Bob",
            targetType: "TOOL",
            targetId: U.t1,
            targetLabel: "Akkuschrauber",
            targetHref: null,
            subjectUserId: null,
            subjectUserName: null,
            ratingPreview: null,
            reason: "Defekt",
            status: "OPEN",
            createdAt: "2026-05-05T10:00:00.000Z"
          }
        ]);
      }

      if (url.endsWith("/moderation/reports/r1") && init?.method === "PATCH") {
        return responseNoContent();
      }

      if (url.endsWith("/ratings/me/received")) {
        return responseJson([
          {
            id: U.rt1,
            bookingId: U.b3,
            fromUserId: U.u2,
            toUserId: U.u1,
            score: 5,
            status: "VISIBLE",
            createdAt: "2026-05-05T12:00:00.000Z",
            fromUser: { id: U.u2, name: "Lea" }
          }
        ]);
      }

      if (url.endsWith("/users/admin/metrics")) {
        return responseJson({ users: 7, tools: 4, workshops: 2, openBookings: 1, openReports: 0, openSuspensionRequests: 0 });
      }

      throw new Error(`Unexpected request ${url}`);
    });

    const tools = await api.getTools({ q: "bohr", category: "holz" }, "token-123");
    expect(tools[0]).toMatchObject({
      id: U.t1,
      ownerId: U.u2,
      status: "VERFUEGBAR",
      imageUrl: expect.any(String)
    });

    const createdTool = await api.createTool({ name: "Bohrhammer", description: "Für Beton", category: "bau" }, "token-123");
    expect(createdTool).toMatchObject({
      id: U.t2,
      status: "AUSGELIEHEN"
    });

    const workshops = await api.getWorkshops({ q: "maker", managerId: "u2" }, "token-123");
    expect(workshops[0].workshop).toMatchObject({
      id: U.w1,
      ownerId: U.u2
    });
    expect(workshops[0].workshop.imageUrls[0]).toBe("workshop.png");
    expect(workshops[0].slots[0]).toMatchObject({ id: U.s1 });
    expect(workshops[0].slots[0].blockedByOwner).toBe(true);
    expect(workshops[0].slots[0].startIso).toMatch(/^2026-05-06T/);

    const detail = await api.getWorkshopById(U.w1, "token-123");
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
    expect(createdWorkshop).toMatchObject({ id: U.w2, ownerId: U.u2 });

    const createdSlot = await api.createWorkshopTimeslot(
      "w2",
      { startIso: "2026-05-07T08:00:00.000Z", endIso: "2026-05-07T10:00:00.000Z", blockedByOwner: false },
      "token-123"
    );
    expect(createdSlot).toMatchObject({ workshopId: U.w2, blockedByOwner: false });

    const updatedSlot = await api.updateWorkshopTimeslot(
      "w2",
      "s1",
      { startIso: "2026-05-07T09:00:00.000Z", endIso: "2026-05-07T11:00:00.000Z", blockedByOwner: true },
      "token-123"
    );
    expect(updatedSlot).toMatchObject({ id: U.s1, blockedByOwner: true });
    expect(updatedSlot.startIso).toMatch(/^2026-05-07T/);
    await api.deleteWorkshopTimeslot("w2", "s1", "token-123");

    const toolBooking = await api.createToolRequest(
      { toolId: "t1", startIso: "2026-05-06T10:00:00.000Z", endIso: "2026-05-06T12:00:00.000Z", pickupTimeIso: "2026-05-06T09:00:00.000Z" },
      "token-123"
    );
    expect(toolBooking).toMatchObject({
      type: "TOOL",
      providerId: U.u2,
      requesterName: undefined,
      providerName: undefined
    });

    const workshopBooking = await api.createWorkshopBooking(
      {
        workshopId: "w1",
        startIso: "2026-05-07T08:00:00.000Z",
        endIso: "2026-05-07T10:00:00.000Z",
        workshopToolIds: ["wt1"]
      },
      "token-123"
    );
    expect(workshopBooking).toMatchObject({
      type: "WORKSHOP",
      providerId: U.u2,
      workshopId: U.w1
    });

    const bookings = await api.getBookingsForUser("token-123");
    expect(bookings[0]).toMatchObject({ id: U.b3, status: "ABGESCHLOSSEN", type: "TOOL" });

    await api.decideBooking("b1", "BESTAETIGT", "token-123");
    await api.createPickupProposal(
      "b1",
      "2026-05-06T13:00:00.000Z",
      "2026-05-07T13:00:00.000Z",
      "token-123"
    );
    await api.respondPickupProposal("b1", "p1", "DECLINE", "token-123");

    const notifications = await api.getNotifications("token-123");
    expect(notifications[0]).toMatchObject({ id: U.n1, createdIso: "2026-05-05T10:00:00.000Z" });

    const reports = await api.listReports("token-123");
    expect(reports).toEqual([expect.objectContaining({ id: U.r1, status: "OPEN" })]);
    await api.updateReportStatus("r1", "RESOLVED", "token-123");

    const ratings = await api.getRatingsReceived("token-123");
    expect(ratings[0]).toMatchObject({ id: U.rt1, score: 5, fromUserName: "Lea", status: "SICHTBAR" });

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
    await expect(
      api.createTool(
        {
          name: "X",
          description: "Test",
          category: "bau",
          pickupLocation: "Leopoldstraße 120, 80802 München, Deutschland"
        },
        "token-123"
      )
    ).rejects.toThrow("Diese E-Mail ist bereits registriert.");

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
    await expect(
      api.createTool(
        {
          name: "X",
          description: "Test",
          category: "bau",
          pickupLocation: "Leopoldstraße 120, 80802 München, Deutschland"
        },
        "token-123"
      )
    ).rejects.toThrow("name: Eingabe muss mindestens 3 Zeichen lang sein.");

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

    await expect(
      api.createPickupProposal("b1", "not-a-date", "2026-05-07T13:00:00.000Z", "token-123")
    ).rejects.toThrow("Ungültiger Abhol- oder Rückgabezeitpunkt.");
  });
});
