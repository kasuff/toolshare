import { beforeEach, describe, expect, it, vi } from "vitest";
import { bookingsRepository } from "../src/modules/bookings/bookings.repository";
import { notificationsRepository } from "../src/modules/notifications/notifications.repository";
import { bookingsService } from "../src/modules/bookings/bookings.service";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    timeSlot: { findFirst: vi.fn() },
    booking: { findFirst: vi.fn(), update: vi.fn() },
    bookingPickupProposal: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock("../src/config/prisma", () => ({
  prisma: prismaMock
}));

vi.mock("../src/modules/bookings/bookings.repository", () => ({
  bookingsRepository: {
    listForUserContext: vi.fn(),
    createToolBookingTransaction: vi.fn(),
    createWorkshopBookingTransaction: vi.fn(),
    findBookingById: vi.fn(),
    findBookingForPickupProposal: vi.fn(),
    declinePendingPickupProposals: vi.fn(),
    createPickupProposal: vi.fn(),
    findBookingForTimeslotProposal: vi.fn(),
    declinePendingTimeslotProposals: vi.fn(),
    createTimeslotProposal: vi.fn(),
    updateStatus: vi.fn(),
    markToolAvailable: vi.fn()
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

  it("creates a tool counter proposal with pickup and return times", async () => {
    mockedBookingsRepository.findBookingForPickupProposal.mockResolvedValueOnce({
      id: "booking-tool-1",
      userId: "requester-1",
      toolId: "tool-1",
      status: "PENDING",
      startDate: new Date("2026-06-01T10:00:00.000Z"),
      endDate: new Date("2026-06-01T14:00:00.000Z"),
      pickupTime: new Date("2026-06-01T10:00:00.000Z"),
      pickupProposals: [],
      tool: { ownerId: "provider-1" }
    } as any);
    prismaMock.booking.findFirst.mockResolvedValueOnce(null);
    prismaMock.$transaction.mockImplementationOnce(async (callback: (tx: unknown) => unknown) => callback({}));
    mockedBookingsRepository.declinePendingPickupProposals.mockResolvedValueOnce({ count: 0 } as any);
    mockedBookingsRepository.createPickupProposal.mockResolvedValueOnce({ id: "pickup-proposal-1" } as any);

    await expect(
      bookingsService.createPickupProposal({
        actorId: "provider-1",
        bookingId: "booking-tool-1",
        pickupTime: "2026-06-02T09:00:00.000Z",
        returnTime: "2026-06-02T15:00:00.000Z"
      })
    ).resolves.toMatchObject({ id: "pickup-proposal-1" });

    expect(mockedBookingsRepository.createPickupProposal).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        proposedPickupTime: new Date("2026-06-02T09:00:00.000Z"),
        proposedReturnTime: new Date("2026-06-02T15:00:00.000Z"),
        previousReturnTime: new Date("2026-06-01T14:00:00.000Z")
      })
    );
  });

  it("applies pickup and return times when a tool counter proposal is accepted", async () => {
    prismaMock.bookingPickupProposal.findFirst.mockResolvedValueOnce({
      id: "pickup-proposal-1",
      bookingId: "booking-tool-1",
      proposedByUserId: "provider-1",
      proposedPickupTime: new Date("2026-06-02T09:00:00.000Z"),
      proposedReturnTime: new Date("2026-06-02T15:00:00.000Z"),
      status: "PENDING",
      booking: {
        id: "booking-tool-1",
        userId: "requester-1",
        endDate: new Date("2026-06-01T14:00:00.000Z"),
        tool: { id: "tool-1", ownerId: "provider-1" },
        timeslot: null
      }
    });
    prismaMock.booking.findFirst.mockResolvedValueOnce(null);
    prismaMock.bookingPickupProposal.updateMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.bookingPickupProposal.update.mockResolvedValueOnce({ id: "pickup-proposal-1" });
    prismaMock.booking.update.mockResolvedValueOnce({ id: "booking-tool-1" });
    prismaMock.$transaction.mockResolvedValueOnce([]);
    prismaMock.bookingPickupProposal.findUnique.mockResolvedValueOnce({
      id: "pickup-proposal-1",
      status: "ACCEPTED"
    });

    await bookingsService.respondPickupProposal({
      actorId: "requester-1",
      bookingId: "booking-tool-1",
      proposalId: "pickup-proposal-1",
      decision: "ACCEPT"
    });

    expect(prismaMock.booking.update).toHaveBeenCalledWith({
      where: { id: "booking-tool-1" },
      data: {
        status: "ACCEPTED",
        pickupTime: new Date("2026-06-02T09:00:00.000Z"),
        startDate: new Date("2026-06-02T09:00:00.000Z"),
        endDate: new Date("2026-06-02T15:00:00.000Z")
      }
    });
  });

  it("creates a workshop counter proposal without requiring tools to be selected again", async () => {
    mockedBookingsRepository.findBookingForTimeslotProposal.mockResolvedValueOnce({
      id: "booking-1",
      userId: "requester-1",
      status: "PENDING",
      startDate: new Date("2026-06-01T10:00:00.000Z"),
      endDate: new Date("2026-06-01T12:00:00.000Z"),
      selectedTools: [],
      timeslotProposals: [],
      timeslot: {
        workshopId: "workshop-1",
        workshop: { managerId: "provider-1" }
      }
    } as any);
    prismaMock.timeSlot.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "availability-1" });
    prismaMock.booking.findFirst.mockResolvedValueOnce(null);
    prismaMock.$transaction.mockImplementationOnce(async (callback: (tx: unknown) => unknown) => callback({}));
    mockedBookingsRepository.declinePendingTimeslotProposals.mockResolvedValueOnce({ count: 0 } as any);
    mockedBookingsRepository.createTimeslotProposal.mockResolvedValueOnce({ id: "proposal-1" } as any);

    await expect(
      bookingsService.createTimeslotProposal({
        actorId: "provider-1",
        bookingId: "booking-1",
        startDate: "2026-06-02T10:00:00.000Z",
        endDate: "2026-06-02T12:00:00.000Z"
      })
    ).resolves.toMatchObject({ id: "proposal-1" });

    expect(mockedBookingsRepository.createTimeslotProposal).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        bookingId: "booking-1",
        proposedByUserId: "provider-1"
      })
    );
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

  it("creates workshop booking and notifies manager", async () => {
    mockedBookingsRepository.createWorkshopBookingTransaction.mockResolvedValueOnce({
      id: "b2",
      timeslot: { workshop: { managerId: "manager-1" } }
    } as any);

    const result = await bookingsService.createWorkshopBooking({
      requesterId: "user-1",
      workshopId: "workshop-1",
      startDate: "2026-06-01T10:00:00.000Z",
      endDate: "2026-06-02T10:00:00.000Z",
      workshopToolIds: ["wt-1"]
    });

    expect(mockedBookingsRepository.createWorkshopBookingTransaction).toHaveBeenCalledWith({
      userId: "user-1",
      workshopId: "workshop-1",
      startDate: new Date("2026-06-01T10:00:00.000Z"),
      endDate: new Date("2026-06-02T10:00:00.000Z"),
      workshopToolIds: ["wt-1"]
    });
    expect(mockedNotificationsRepository.create).toHaveBeenCalledWith("manager-1", expect.stringContaining("Werkstatt"));
    expect(result).toMatchObject({ id: "b2" });
  });

  it("maps workshop booking repository errors to app errors", async () => {
    mockedBookingsRepository.createWorkshopBookingTransaction.mockResolvedValueOnce("TOOLS_REQUIRED" as any);

    await expect(
      bookingsService.createWorkshopBooking({
        requesterId: "user-1",
        workshopId: "workshop-1",
        startDate: "2026-06-01T10:00:00.000Z",
        endDate: "2026-06-02T10:00:00.000Z",
        workshopToolIds: []
      })
    ).rejects.toMatchObject({ code: "WORKSHOP_TOOLS_REQUIRED", status: 400 });
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

  it("updates booking status as provider and sends notification", async () => {
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

  it("completes an accepted tool booking as provider and marks the tool available", async () => {
    mockedBookingsRepository.findBookingById.mockResolvedValueOnce({
      id: "b1",
      userId: "requester-1",
      status: "ACCEPTED",
      endDate: new Date("2026-05-01T10:00:00.000Z"),
      tool: { id: "tool-1", ownerId: "owner-1" }
    } as any);
    mockedBookingsRepository.updateStatus.mockResolvedValueOnce({ id: "b1", status: "RETURNED" } as any);
    mockedBookingsRepository.markToolAvailable.mockResolvedValueOnce({ id: "tool-1", status: "AVAILABLE" } as any);

    const result = await bookingsService.updateBookingStatus({
      actorId: "owner-1",
      actorRole: "USER",
      bookingId: "b1",
      status: "RETURNED"
    });

    expect(mockedBookingsRepository.updateStatus).toHaveBeenCalledWith("b1", "RETURNED");
    expect(mockedBookingsRepository.markToolAvailable).toHaveBeenCalledWith("tool-1");
    expect(mockedNotificationsRepository.create).toHaveBeenCalledWith("requester-1", expect.stringContaining("RETURNED"));
    expect(result).toMatchObject({ id: "b1", status: "RETURNED" });
  });

  it("completes an accepted workshop booking as workshop provider", async () => {
    mockedBookingsRepository.findBookingById.mockResolvedValueOnce({
      id: "b2",
      userId: "requester-1",
      status: "ACCEPTED",
      endDate: new Date("2026-05-01T12:00:00.000Z"),
      timeslot: { workshop: { managerId: "manager-1" } }
    } as any);
    mockedBookingsRepository.updateStatus.mockResolvedValueOnce({ id: "b2", status: "RETURNED" } as any);

    const result = await bookingsService.updateBookingStatus({
      actorId: "manager-1",
      actorRole: "USER",
      bookingId: "b2",
      status: "RETURNED"
    });

    expect(mockedBookingsRepository.updateStatus).toHaveBeenCalledWith("b2", "RETURNED");
    expect(mockedBookingsRepository.markToolAvailable).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: "b2", status: "RETURNED" });
  });

  it("rejects completion by requester", async () => {
    mockedBookingsRepository.findBookingById.mockResolvedValueOnce({
      id: "b1",
      userId: "requester-1",
      status: "ACCEPTED",
      endDate: new Date("2026-05-01T10:00:00.000Z"),
      tool: { id: "tool-1", ownerId: "owner-1" }
    } as any);

    await expect(
      bookingsService.updateBookingStatus({
        actorId: "requester-1",
        actorRole: "USER",
        bookingId: "b1",
        status: "RETURNED"
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("allows a provider to complete a returned tool before the planned end time", async () => {
    mockedBookingsRepository.findBookingById.mockResolvedValueOnce({
      id: "b1",
      userId: "requester-1",
      status: "ACCEPTED",
      endDate: new Date(Date.now() + 60_000),
      tool: { id: "tool-1", ownerId: "owner-1" }
    } as any);
    mockedBookingsRepository.updateStatus.mockResolvedValueOnce({ id: "b1", status: "RETURNED" } as any);
    mockedBookingsRepository.markToolAvailable.mockResolvedValueOnce({ id: "tool-1", status: "AVAILABLE" } as any);

    await expect(
      bookingsService.updateBookingStatus({
        actorId: "owner-1",
        actorRole: "USER",
        bookingId: "b1",
        status: "RETURNED"
      })
    ).resolves.toMatchObject({ id: "b1", status: "RETURNED" });
  });

  it("rejects workshop completion before the confirmed usage period ended", async () => {
    mockedBookingsRepository.findBookingById.mockResolvedValueOnce({
      id: "b2",
      userId: "requester-1",
      status: "ACCEPTED",
      endDate: new Date(Date.now() + 60_000),
      timeslot: { workshop: { managerId: "manager-1" } }
    } as any);

    await expect(
      bookingsService.updateBookingStatus({
        actorId: "manager-1",
        actorRole: "USER",
        bookingId: "b2",
        status: "RETURNED"
      })
    ).rejects.toMatchObject({ code: "BOOKING_NOT_ENDED", status: 400 });
  });

});
