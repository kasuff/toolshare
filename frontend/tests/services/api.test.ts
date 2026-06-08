import { describe, expect, it, vi, beforeEach } from "vitest";
import { api } from "../../src/services/api";
import { SESSION_EXPIRED_EVENT, SESSION_EXPIRED_MESSAGE } from "../../src/services/sessionEvents";
import { DEFAULT_PLACEHOLDER_IMAGE } from "../../src/utils/categories";

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

function responseJson(body: unknown, init?: ResponseInit) {
  return {
    ok: (init?.status ?? 200) >= 200 && (init?.status ?? 200) < 300,
    status: init?.status ?? 200,
    json: async () => body
  } as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe("api service", () => {
  it("notifies the app and returns a consistent error for expired authenticated requests", async () => {
    const handleSessionExpired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    fetchMock.mockResolvedValueOnce(responseJson({ error: { message: "Invalid or expired token" } }, { status: 401 }));

    await expect(api.getCurrentUser("expired-token")).rejects.toThrow(SESSION_EXPIRED_MESSAGE);

    expect(handleSessionExpired).toHaveBeenCalledTimes(1);
    window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  });

  it("maps backend users and sends authorization headers", async () => {
    fetchMock.mockResolvedValueOnce(
      responseJson({ id: "u1", email: "lea@toolshare.local", name: "Lea", role: "MANAGER", isSuspended: false })
    );

    const user = await api.getCurrentUser("token-123");

    expect(user).toEqual({
      id: "u1",
      email: "lea@toolshare.local",
      name: "Lea",
      role: "ADMIN",
      address: undefined,
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
            id: "t1",
            ownerId: "u3",
            name: "Akkuschrauber",
            description: "Mit Bits",
            category: "Elektro",
            imageUrl: null,
            status: "AVAILABLE"
          }
        ]);
      }

      if (url.includes("/workshops?") || url.endsWith("/workshops")) {
        return responseJson([
          {
            id: "w1",
            managerId: "u2",
            name: "Werkstatt",
            description: "Gemeinschaftsraum",
            location: "München",
            maxCapacity: 4,
            timeslots: []
          }
        ]);
      }

      if (url.endsWith("/workshops/w1")) {
        return responseJson({
          id: "w1",
          managerId: "u2",
          name: "Werkstatt",
          description: "Gemeinschaftsraum",
          location: "München",
          maxCapacity: 4,
          timeslots: [
            { id: "s1", workshopId: "w1", startTime: "2026-05-06T10:00:00.000Z", endTime: "2026-05-06T12:00:00.000Z" }
          ]
        });
      }

      if (url.endsWith("/bookings/me")) {
        return responseJson([
          {
            id: "b1",
            userId: "u1",
            toolId: "t1",
            startDate: "2026-05-06T10:00:00.000Z",
            endDate: "2026-05-07T10:00:00.000Z",
            pickupTime: null,
            status: "PENDING",
            tool: { ownerId: "u3" }
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
          openReports: 1
        });
      }

      if (url.endsWith("/users")) {
        return responseJson([
          { id: "u1", email: "a@example.com", name: "A", role: "USER" },
          { id: "u2", email: "b@example.com", name: "B", role: "MODERATOR" }
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
      id: "t1",
      ownerId: "u3",
      status: "VERFUEGBAR",
      imageUrl: DEFAULT_PLACEHOLDER_IMAGE
    });
    expect(workshops[0].workshop).toMatchObject({
      id: "w1",
      ownerId: "u2",
      imageUrls: [DEFAULT_PLACEHOLDER_IMAGE]
    });
    expect(workshops[0].slots[0]).toMatchObject({
      id: "s1",
      workshopId: "w1",
      blockedByOwner: false
    });
    expect(bookings[0]).toMatchObject({
      id: "b1",
      type: "TOOL",
      requesterId: "u1",
      providerId: "u3",
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
      id: "b1",
      userId: "u1",
      toolId: "t1",
      startDate: "2026-05-06T10:00:00.000Z",
      endDate: "2026-05-07T10:00:00.000Z",
      pickupTime: "2026-05-06T09:00:00.000Z",
      status: "PENDING",
      tool: { ownerId: "u3" }
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
      id: "b1",
      type: "TOOL",
      providerId: "u3"
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
