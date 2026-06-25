import { describe, expect, it, vi, beforeEach } from "vitest";
import { api } from "@toolshare/shared";
import { configureAuthSession, onSessionExpired, SESSION_EXPIRED_MESSAGE } from "@toolshare/shared";
import { DEFAULT_PLACEHOLDER_IMAGE } from "@toolshare/shared";

const fetchMock = vi.fn();

// Gültige UUIDs für schema-konforme Backend-Payloads (die Response-Contracts
// erzwingen z.string().uuid() auf allen IDs).
const ID = {
  u1: "11111111-1111-1111-1111-111111111111",
  u2: "22222222-2222-2222-2222-222222222222",
  u3: "33333333-3333-3333-3333-333333333333",
  t1: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  w1: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  s1: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  b1: "dddddddd-dddd-dddd-dddd-dddddddddddd"
} as const;

function responseJson(body: unknown, init?: ResponseInit) {
  return {
    ok: (init?.status ?? 200) >= 200 && (init?.status ?? 200) < 300,
    status: init?.status ?? 200,
    json: async () => body
  } as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  configureAuthSession({
    getAccessToken: () => null,
    getRefreshToken: () => null,
    setTokens: vi.fn(),
    clearTokens: vi.fn()
  });
});

describe("api service", () => {
  it("notifies the app and returns a consistent error for expired authenticated requests", async () => {
    const handleSessionExpired = vi.fn();
    const unsubscribe = onSessionExpired(handleSessionExpired);
    fetchMock.mockResolvedValueOnce(responseJson({ error: { message: "Invalid or expired token" } }, { status: 401 }));

    await expect(api.getCurrentUser("expired-token")).rejects.toThrow(SESSION_EXPIRED_MESSAGE);

    expect(handleSessionExpired).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("silently refreshes expired access tokens and retries the original request", async () => {
    const setTokens = vi.fn();
    configureAuthSession({
      getAccessToken: () => "expired-token",
      getRefreshToken: () => "valid-refresh",
      setTokens,
      clearTokens: vi.fn()
    });

    fetchMock
      .mockResolvedValueOnce(responseJson({ error: { message: "Invalid or expired token" } }, { status: 401 }))
      .mockResolvedValueOnce(
        responseJson({ accessToken: "new-access-token", refreshToken: "new-refresh-token" })
      )
      .mockResolvedValueOnce(
        responseJson({ id: ID.u1, email: "lea@toolshare.local", name: "Lea", address: "Musterstraße 1, 80331 München", role: "USER", isSuspended: false })
      );

    const user = await api.getCurrentUser("expired-token");

    expect(user.name).toBe("Lea");
    expect(setTokens).toHaveBeenCalledWith({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token"
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toBe("http://localhost:4000/api/users/me");
    expect(fetchMock.mock.calls[2][1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: "Bearer new-access-token" })
    });
  });

  it("maps backend users and sends authorization headers", async () => {
    fetchMock.mockResolvedValueOnce(
      responseJson({ id: ID.u1, email: "lea@toolshare.local", name: "Lea", address: "Musterstraße 1, 80331 München", role: "MANAGER", isSuspended: false })
    );

    const user = await api.getCurrentUser("token-123");

    expect(user).toEqual({
      id: ID.u1,
      email: "lea@toolshare.local",
      name: "Lea",
      role: "ADMIN",
      address: "Musterstraße 1, 80331 München",
      isSuspended: false
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/users/me",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-123" })
      })
    );
  });

  it("maps tools, workshops and bookings from backend payloads", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes("/tools")) {
        return responseJson([
          {
            id: ID.t1,
            ownerId: ID.u3,
            name: "Akkuschrauber",
            description: "Mit Bits",
            category: "Elektro",
            imageUrl: null,
            pickupLocation: "München",
            pickupLocationNote: null,
            status: "AVAILABLE",
            createdAt: "2026-05-01T10:00:00.000Z",
            updatedAt: "2026-05-01T10:00:00.000Z",
            owner: { id: ID.u3, name: "Owner", role: "USER", isSuspended: false }
          }
        ]);
      }

      if (url.includes("/workshops?") || url.endsWith("/workshops")) {
        return responseJson([
          {
            id: ID.w1,
            managerId: ID.u2,
            name: "Werkstatt",
            description: "Gemeinschaftsraum",
            location: "München",
            maxCapacity: 4,
            extras: [],
            imageUrls: [],
            timeslots: [
              { id: ID.s1, workshopId: ID.w1, startTime: "2026-05-06T10:00:00.000Z", endTime: "2026-05-06T12:00:00.000Z", blockedByOwner: false }
            ]
          }
        ]);
      }

      if (url.endsWith(`/workshops/${ID.w1}`)) {
        return responseJson({
          id: ID.w1,
          managerId: ID.u2,
          name: "Werkstatt",
          description: "Gemeinschaftsraum",
          location: "München",
          maxCapacity: 4,
          extras: [],
          imageUrls: [],
          timeslots: [
            { id: ID.s1, workshopId: ID.w1, startTime: "2026-05-06T10:00:00.000Z", endTime: "2026-05-06T12:00:00.000Z", blockedByOwner: false }
          ]
        });
      }

      if (url.endsWith("/bookings/me")) {
        return responseJson([
          {
            id: ID.b1,
            userId: ID.u1,
            toolId: ID.t1,
            startDate: "2026-05-06T10:00:00.000Z",
            endDate: "2026-05-07T10:00:00.000Z",
            pickupTime: null,
            status: "PENDING",
            tool: { id: ID.t1, ownerId: ID.u3, name: "Akkuschrauber" }
          }
        ]);
      }

      if (url.endsWith("/moderation/reports")) {
        return responseJson([{ id: "r1", reason: "Test", status: "OPEN" }]);
      }

      if (url.includes("/users/admin/metrics")) {
        return responseJson({
          users: 2,
          tools: 3,
          workshops: 1,
          openBookings: 4,
          openReports: 1,
          openSuspensionRequests: 0
        });
      }

      if (url.endsWith("/users")) {
        return responseJson([
          { id: ID.u1, email: "a@example.com", name: "A", address: "München", role: "USER", isSuspended: false },
          { id: ID.u2, email: "b@example.com", name: "B", address: "München", role: "MODERATOR", isSuspended: false }
        ]);
      }

      if (url.endsWith("/users/admin/metrics")) {
        return responseJson({
          users: 2,
          tools: 1,
          workshops: 1,
          openBookings: 1,
          openReports: 1
        });
      }

      return responseJson([]);
    });

    const tools = await api.getTools({}, "token-123");
    const workshops = await api.getWorkshops({}, "token-123");
    const bookings = await api.getBookingsForUser("token-123");
    const metrics = await api.getMetrics("token-123");

    expect(tools[0]).toMatchObject({
      id: ID.t1,
      ownerId: ID.u3,
      status: "VERFUEGBAR",
      imageUrl: DEFAULT_PLACEHOLDER_IMAGE
    });
    expect(workshops[0].workshop).toMatchObject({
      id: ID.w1,
      ownerId: ID.u2,
      imageUrls: [DEFAULT_PLACEHOLDER_IMAGE]
    });
    expect(workshops[0].slots[0]).toMatchObject({
      id: ID.s1,
      workshopId: ID.w1,
      blockedByOwner: false
    });
    expect(bookings[0]).toMatchObject({
      id: ID.b1,
      type: "TOOL",
      requesterId: ID.u1,
      providerId: ID.u3,
      status: "OFFEN"
    });
    expect(metrics).toMatchObject({
      users: expect.any(Number),
      tools: expect.any(Number),
      workshops: expect.any(Number),
      openBookings: expect.any(Number),
      openReports: expect.any(Number)
    });
  });

  it("creates tool requests and forwards the ISO payloads", async () => {
    fetchMock.mockResolvedValueOnce(responseJson({
      id: ID.b1,
      userId: ID.u1,
      toolId: ID.t1,
      startDate: "2026-05-06T10:00:00.000Z",
      endDate: "2026-05-07T10:00:00.000Z",
      pickupTime: "2026-05-06T09:00:00.000Z",
      status: "PENDING",
      tool: { id: ID.t1, ownerId: ID.u3, name: "Akkuschrauber" }
    }));

    const booking = await api.createToolRequest(
      {
        toolId: "t1",
        startIso: "2026-05-06T10:00",
        endIso: "2026-05-07T10:00",
        pickupTimeIso: "2026-05-06T09:00"
      },
      "token-123"
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/bookings/tool",
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-123"
        },
        method: "POST",
        body: JSON.stringify({
          toolId: "t1",
          startDate: new Date("2026-05-06T10:00").toISOString(),
          endDate: new Date("2026-05-07T10:00").toISOString(),
          pickupTime: new Date("2026-05-06T09:00").toISOString()
        })
      }
    );
    expect(booking).toMatchObject({
      id: ID.b1,
      type: "TOOL",
      providerId: ID.u3
    });
  });

  it("sends pickup and return times for tool counter proposals", async () => {
    fetchMock.mockResolvedValueOnce(responseJson({ id: "proposal-1" }, { status: 201 }));

    await api.createPickupProposal(
      "b1",
      "2026-05-06T12:00:00.000Z",
      "2026-05-07T14:00:00.000Z",
      "token-123"
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/bookings/b1/pickup-proposals",
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-123"
        },
        method: "POST",
        body: JSON.stringify({
          pickupTime: "2026-05-06T12:00:00.000Z",
          returnTime: "2026-05-07T14:00:00.000Z"
        })
      }
    );
  });

  it("surfaces backend validation messages", async () => {
    fetchMock.mockResolvedValueOnce(responseJson(
      {
        error: {
          message: "Validation failed",
          details: { fieldErrors: { name: ["required"] } }
        }
      },
      { status: 400 }
    ));

    await expect(
      api.createTool(
        {
          name: "",
          description: "Test",
          category: "holz",
          pickupLocation: "Leopoldstraße 120, 80802 München, Deutschland"
        },
        "token-123"
      )
    ).rejects.toThrow(/name: Pflichtfeld fehlt/);
  });
});
