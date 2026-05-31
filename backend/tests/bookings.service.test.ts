import { beforeEach, describe, expect, it, vi } from "vitest";
import { bookingsRepository } from "../src/modules/bookings/bookings.repository";
import { notificationsRepository } from "../src/modules/notifications/notifications.repository";
import { bookingsService } from "../src/modules/bookings/bookings.service";

vi.mock("../src/modules/bookings/bookings.repository", () => ({
  bookingsRepository: {
    listForUserContext: vi.fn(),
    createToolBookingTransaction: vi.fn(),
    createWorkshopBookingTransaction: vi.fn(),
    findBookingById: vi.fn(),
    updateStatus: vi.fn()
  }
}));

vi.mock("../src/modules/notifications/notifications.repository", () => ({
  notificationsRepository: {
    create: vi.fn()
  }
}));

const mockedBookingsRepository = vi.mocked(bookingsRepository);
const mockedNotificationsRepository = vi.mocked(notificationsRepository);

describe("bookingsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists bookings for user context", async () => {
    mockedBookingsRepository.listForUserContext.mockResolvedValueOnce([{ id: "b1" }] as any);

    const result = await bookingsService.listForUserContext("u1");

    expect(mockedBookingsRepository.listForUserContext).toHaveBeenCalledWith("u1");
    expect(result).toEqual([{ id: "b1" }]);
  });

  it("rejects tool booking when tool does not exist", async () => {
    mockedBookingsRepository.createToolBookingTransaction.mockResolvedValueOnce(null as any);

    await expect(
      bookingsService.createToolBooking({
        requesterId: "u1",
        toolId: "missing",
        startDate: "2026-06-01T10:00:00.000Z",
        endDate: "2026-06-02T10:00:00.000Z",
        pickupTime: "2026-06-01T09:00:00.000Z"
      })
    ).rejects.toMatchObject({ code: "TOOL_NOT_FOUND", status: 404 });
  });

  it("rejects tool booking with invalid time range", async () => {
    await expect(
      bookingsService.createToolBooking({
        requesterId: "u1",
        toolId: "t1",
        startDate: "2026-06-02T10:00:00.000Z",
        endDate: "2026-06-01T10:00:00.000Z",
        pickupTime: "2026-06-01T09:00:00.000Z"
      })
    ).rejects.toMatchObject({ code: "INVALID_TIME_RANGE", status: 400 });
  });

  it("rejects tool booking when overlapping booking exists", async () => {
    mockedBookingsRepository.createToolBookingTransaction.mockResolvedValueOnce("CONFLICT" as any);

    await expect(
      bookingsService.createToolBooking({
        requesterId: "u1",
        toolId: "t1",
        startDate: "2026-06-01T10:00:00.000Z",
        endDate: "2026-06-02T10:00:00.000Z",
        pickupTime: "2026-06-01T09:00:00.000Z"
      })
    ).rejects.toMatchObject({ code: "BOOKING_CONFLICT", status: 409 });
  });

  it("creates tool booking and notifies owner", async () => {
    mockedBookingsRepository.createToolBookingTransaction.mockResolvedValueOnce({
      booking: { id: "b1", toolId: "t1" },
      tool: { ownerId: "owner-1" }
    } as any);

    const result = await bookingsService.createToolBooking({
      requesterId: "u1",
      toolId: "t1",
      startDate: "2026-06-01T10:00:00.000Z",
      endDate: "2026-06-02T10:00:00.000Z",
      pickupTime: "2026-06-01T09:00:00.000Z"
    });

    expect(mockedBookingsRepository.createToolBookingTransaction).toHaveBeenCalled();
    expect(mockedNotificationsRepository.create).toHaveBeenCalledWith("owner-1", expect.stringContaining("Ausleihanfrage"));
    expect(result).toMatchObject({ id: "b1" });
  });

  it("rejects workshop booking when workshop does not exist", async () => {
    mockedBookingsRepository.createWorkshopBookingTransaction.mockResolvedValueOnce("WORKSHOP_NOT_FOUND" as any);

    await expect(
      bookingsService.createWorkshopBooking({
        requesterId: "u1",
        workshopId: "workshop-1",
        startDate: "2026-06-01T10:00:00.000Z",
        endDate: "2026-06-03T10:00:00.000Z",
        workshopToolIds: ["workshop-tool-1"]
      })
    ).rejects.toMatchObject({ code: "WORKSHOP_NOT_FOUND", status: 404 });
  });

  it("rejects workshop booking conflicts", async () => {
    mockedBookingsRepository.createWorkshopBookingTransaction.mockResolvedValueOnce("CONFLICT" as any);

    await expect(
      bookingsService.createWorkshopBooking({
        requesterId: "u1",
        workshopId: "workshop-1",
        startDate: "2026-06-01T10:00:00.000Z",
        endDate: "2026-06-03T10:00:00.000Z",
        workshopToolIds: ["workshop-tool-1"]
      })
    ).rejects.toMatchObject({ code: "BOOKING_CONFLICT", status: 409 });
  });

  it("rejects workshop booking when timeslot is owner blocked", async () => {
    mockedBookingsRepository.createWorkshopBookingTransaction.mockResolvedValueOnce("BLOCKED" as any);

    await expect(
      bookingsService.createWorkshopBooking({
        requesterId: "u1",
        workshopId: "workshop-1",
        startDate: "2026-06-01T10:00:00.000Z",
        endDate: "2026-06-03T10:00:00.000Z",
        workshopToolIds: ["workshop-tool-1"]
      })
    ).rejects.toMatchObject({ code: "TIMESLOT_BLOCKED", status: 409 });
  });

  it("rejects workshop booking with invalid time range", async () => {
    await expect(
      bookingsService.createWorkshopBooking({
        requesterId: "u1",
        workshopId: "workshop-1",
        startDate: "2026-06-03T10:00:00.000Z",
        endDate: "2026-06-01T10:00:00.000Z",
        workshopToolIds: ["workshop-tool-1"]
      })
    ).rejects.toMatchObject({ code: "INVALID_TIME_RANGE", status: 400 });
  });

  it("returns created workshop booking", async () => {
    mockedBookingsRepository.createWorkshopBookingTransaction.mockResolvedValueOnce({ id: "b2" } as any);

    const result = await bookingsService.createWorkshopBooking({
      requesterId: "u1",
      workshopId: "workshop-1",
      startDate: "2026-06-01T10:00:00.000Z",
      endDate: "2026-06-03T10:00:00.000Z",
      workshopToolIds: ["workshop-tool-1"]
    });

    expect(result).toMatchObject({ id: "b2" });
  });

  it("rejects booking status updates when booking is missing", async () => {
    mockedBookingsRepository.findBookingById.mockResolvedValueOnce(null);

    await expect(
      bookingsService.updateBookingStatus({
        actorId: "u1",
        actorRole: "MANAGER",
        bookingId: "missing",
        status: "ACCEPTED"
      })
    ).rejects.toMatchObject({ code: "BOOKING_NOT_FOUND", status: 404 });
  });

  it("rejects booking status updates for unauthorized actors", async () => {
    mockedBookingsRepository.findBookingById.mockResolvedValueOnce({
      id: "b1",
      userId: "requester-1",
      tool: { ownerId: "owner-1" }
    } as any);

    await expect(
      bookingsService.updateBookingStatus({
        actorId: "other-user",
        actorRole: "USER",
        bookingId: "b1",
        status: "REJECTED"
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("updates booking status as tool owner and sends notification", async () => {
    mockedBookingsRepository.findBookingById.mockResolvedValueOnce({
      id: "b1",
      userId: "requester-1",
      tool: { ownerId: "owner-1" }
    } as any);
    mockedBookingsRepository.updateStatus.mockResolvedValueOnce({ id: "b1", status: "ACCEPTED" } as any);

    const result = await bookingsService.updateBookingStatus({
      actorId: "owner-1",
      actorRole: "USER",
      bookingId: "b1",
      status: "ACCEPTED"
    });

    expect(mockedBookingsRepository.updateStatus).toHaveBeenCalledWith("b1", "ACCEPTED");
    expect(mockedNotificationsRepository.create).toHaveBeenCalledWith("requester-1", expect.stringContaining("ACCEPTED"));
    expect(result).toMatchObject({ id: "b1", status: "ACCEPTED" });
  });

  it("allows moderators to update booking status", async () => {
    mockedBookingsRepository.findBookingById.mockResolvedValueOnce({
      id: "b1",
      userId: "requester-1",
      tool: { ownerId: "owner-1" }
    } as any);
    mockedBookingsRepository.updateStatus.mockResolvedValueOnce({ id: "b1", status: "REJECTED" } as any);

    const result = await bookingsService.updateBookingStatus({
      actorId: "mod-1",
      actorRole: "MODERATOR",
      bookingId: "b1",
      status: "REJECTED"
    });

    expect(result).toMatchObject({ id: "b1", status: "REJECTED" });
  });
});
