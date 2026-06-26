import { beforeEach, describe, expect, it, vi } from "vitest";
import { bookingsRepository } from "../src/modules/bookings/bookings.repository";
import { enqueueProposalNotification } from "../src/infrastructure/outbox/enqueue-user-notification";
import { toolsService } from "../src/modules/tools/tools.service";
import { workshopsService } from "../src/modules/workshops/workshops.service";
import { bookingsService } from "../src/modules/bookings/bookings.service";
import { systemRulesService } from "../src/modules/system-rules/system-rules.service";

vi.mock("../src/modules/bookings/bookings.repository", () => ({
  bookingsRepository: {
    listForUserContext: vi.fn(),
    createToolBookingTransaction: vi.fn(),
    createToolOwnerBlockTransaction: vi.fn(),
    createWorkshopBookingTransaction: vi.fn(),
    findBookingById: vi.fn(),
    findBookingForPickupProposal: vi.fn(),
    declinePendingPickupProposals: vi.fn(),
    createPickupProposal: vi.fn(),
    findBookingForTimeslotProposal: vi.fn(),
    declinePendingTimeslotProposals: vi.fn(),
    createTimeslotProposal: vi.fn(),
    updateStatus: vi.fn(),
    markToolAvailable: vi.fn(),
    findToolBookingOverlap: vi.fn(),
    runPickupProposalCreation: vi.fn(),
    findPickupProposalWithBooking: vi.fn(),
    declinePickupProposal: vi.fn(),
    findPickupProposalById: vi.fn(),
    acceptPickupProposalTransaction: vi.fn(),
    runTimeslotProposalCreation: vi.fn(),
    findOverlappingBlockedWorkshopSlot: vi.fn(),
    findWorkshopBookingOverlap: vi.fn(),
    findTimeslotProposalWithBooking: vi.fn(),
    declineTimeslotProposal: vi.fn(),
    findTimeslotProposalById: vi.fn(),
    acceptTimeslotProposalTransaction: vi.fn()
  }
}));

vi.mock("../src/infrastructure/outbox/enqueue-user-notification", () => ({
  enqueueProposalNotification: vi.fn()
}));

vi.mock("../src/modules/system-rules/system-rules.service", () => ({
  systemRulesService: {
    getValues: vi.fn()
  }
}));

vi.mock("../src/modules/tools/tools.service", () => ({
  toolsService: {
    getById: vi.fn()
  }
}));

vi.mock("../src/modules/workshops/workshops.service", () => ({
  workshopsService: {
    getById: vi.fn()
  }
}));

const mockedBookingsRepository = vi.mocked(bookingsRepository);
const mockedEnqueueProposalNotification = vi.mocked(enqueueProposalNotification);
const mockedSystemRulesService = vi.mocked(systemRulesService);
const mockedToolsService = vi.mocked(toolsService);
const mockedWorkshopsService = vi.mocked(workshopsService);

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// Gültiges Buchungsfenster relativ zu "jetzt": 2 Tage Vorlauf, 1 Tag Dauer.
const futureIso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const validStart = () => futureIso(2 * DAY);
const validEnd = () => futureIso(3 * DAY);
const validPickup = () => futureIso(2 * DAY - HOUR);

describe("bookingsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSystemRulesService.getValues.mockResolvedValue({
      maxLoanDurationDays: 14,
      minBookingLeadTimeHours: 12,
      maxAdvanceBookingDays: 60,
      maxConcurrentLoansPerUser: 5,
      unansweredRequestExpiryHours: 48,
      warningsUntilSuspension: 3,
      temporarySuspensionDurationDays: 7,
      maxSearchRadiusKm: 20,
      maxActiveOffersPerUser: 20
    });
    mockedToolsService.getById.mockResolvedValue({ id: "t1", owner: { isSuspended: false } } as any);
    mockedWorkshopsService.getById.mockResolvedValue({ id: "w1", manager: { isSuspended: false } } as any);
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
    mockedBookingsRepository.findToolBookingOverlap.mockResolvedValueOnce(null);
    mockedBookingsRepository.runPickupProposalCreation.mockResolvedValueOnce({ id: "pickup-proposal-1" } as any);

    await expect(
      bookingsService.createPickupProposal({
        actorId: "provider-1",
        bookingId: "booking-tool-1",
        pickupTime: "2026-06-02T09:00:00.000Z",
        returnTime: "2026-06-02T15:00:00.000Z"
      })
    ).resolves.toMatchObject({ id: "pickup-proposal-1" });

    expect(mockedBookingsRepository.runPickupProposalCreation).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "booking-tool-1",
        proposedPickupTime: new Date("2026-06-02T09:00:00.000Z"),
        proposedReturnTime: new Date("2026-06-02T15:00:00.000Z"),
        previousReturnTime: new Date("2026-06-01T14:00:00.000Z")
      })
    );
  });

  it("applies pickup and return times when a tool counter proposal is accepted", async () => {
    mockedBookingsRepository.findPickupProposalWithBooking.mockResolvedValueOnce({
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
    } as any);
    mockedBookingsRepository.findToolBookingOverlap.mockResolvedValueOnce(null);
    mockedBookingsRepository.acceptPickupProposalTransaction.mockResolvedValueOnce([] as any);
    mockedBookingsRepository.findPickupProposalById.mockResolvedValueOnce({
      id: "pickup-proposal-1",
      status: "ACCEPTED"
    } as any);

    await bookingsService.respondPickupProposal({
      actorId: "requester-1",
      bookingId: "booking-tool-1",
      proposalId: "pickup-proposal-1",
      decision: "ACCEPT"
    });

    expect(mockedBookingsRepository.acceptPickupProposalTransaction).toHaveBeenCalledWith({
      bookingId: "booking-tool-1",
      proposalId: "pickup-proposal-1",
      pickupTime: new Date("2026-06-02T09:00:00.000Z"),
      startDate: new Date("2026-06-02T09:00:00.000Z"),
      endDate: new Date("2026-06-02T15:00:00.000Z")
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
    mockedBookingsRepository.findOverlappingBlockedWorkshopSlot.mockResolvedValueOnce(null);
    mockedBookingsRepository.findWorkshopBookingOverlap.mockResolvedValueOnce(null);
    mockedBookingsRepository.runTimeslotProposalCreation.mockResolvedValueOnce({ id: "proposal-1" } as any);

    await expect(
      bookingsService.createTimeslotProposal({
        actorId: "provider-1",
        bookingId: "booking-1",
        startDate: "2026-06-02T10:00:00.000Z",
        endDate: "2026-06-02T12:00:00.000Z"
      })
    ).resolves.toMatchObject({ id: "proposal-1" });

    expect(mockedBookingsRepository.runTimeslotProposalCreation).toHaveBeenCalledWith(
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
    mockedToolsService.getById.mockRejectedValueOnce({ code: "TOOL_NOT_FOUND", status: 404 });

    await expect(
      bookingsService.createToolBooking({
        requesterId: "u1",
        toolId: "missing",
        startDate: validStart(),
        endDate: validEnd(),
        pickupTime: validPickup()
      })
    ).rejects.toMatchObject({ code: "TOOL_NOT_FOUND", status: 404 });
    expect(mockedBookingsRepository.createToolBookingTransaction).not.toHaveBeenCalled();
  });

  it("rejects tool booking when it starts inside the minimum lead time", async () => {
    await expect(
      bookingsService.createToolBooking({
        requesterId: "u1",
        toolId: "t1",
        startDate: futureIso(HOUR),
        endDate: futureIso(2 * HOUR),
        pickupTime: futureIso(HOUR)
      })
    ).rejects.toMatchObject({ code: "BOOKING_LEAD_TIME", status: 400 });
    expect(mockedBookingsRepository.createToolBookingTransaction).not.toHaveBeenCalled();
  });

  it("rejects tool booking that exceeds the maximum advance booking window", async () => {
    await expect(
      bookingsService.createToolBooking({
        requesterId: "u1",
        toolId: "t1",
        startDate: futureIso(90 * DAY),
        endDate: futureIso(91 * DAY),
        pickupTime: futureIso(90 * DAY - HOUR)
      })
    ).rejects.toMatchObject({ code: "BOOKING_TOO_FAR_AHEAD", status: 400 });
    expect(mockedBookingsRepository.createToolBookingTransaction).not.toHaveBeenCalled();
  });

  it("rejects tool booking that exceeds the maximum loan duration", async () => {
    await expect(
      bookingsService.createToolBooking({
        requesterId: "u1",
        toolId: "t1",
        startDate: futureIso(2 * DAY),
        endDate: futureIso(20 * DAY),
        pickupTime: futureIso(2 * DAY - HOUR)
      })
    ).rejects.toMatchObject({ code: "BOOKING_TOO_LONG", status: 400 });
    expect(mockedBookingsRepository.createToolBookingTransaction).not.toHaveBeenCalled();
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
        startDate: validStart(),
        endDate: validEnd(),
        pickupTime: validPickup()
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
      startDate: validStart(),
      endDate: validEnd(),
      pickupTime: validPickup()
    });

    expect(mockedToolsService.getById).toHaveBeenCalledWith("t1");
    expect(mockedBookingsRepository.createToolBookingTransaction).toHaveBeenCalled();
    expect(result).toMatchObject({ id: "b1" });
  });

  it("creates workshop booking and notifies manager", async () => {
    mockedBookingsRepository.createWorkshopBookingTransaction.mockResolvedValueOnce({
      id: "b2",
      timeslot: { workshop: { managerId: "manager-1" } }
    } as any);

    const startDate = validStart();
    const endDate = validEnd();
    const result = await bookingsService.createWorkshopBooking({
      requesterId: "user-1",
      workshopId: "workshop-1",
      startDate,
      endDate,
      workshopToolIds: ["wt-1"]
    });

    expect(mockedWorkshopsService.getById).toHaveBeenCalledWith("workshop-1");
    expect(mockedBookingsRepository.createWorkshopBookingTransaction).toHaveBeenCalledWith({
      userId: "user-1",
      workshopId: "workshop-1",
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      workshopToolIds: ["wt-1"]
    });
    expect(result).toMatchObject({ id: "b2" });
  });

  it("maps workshop booking repository errors to app errors", async () => {
    mockedBookingsRepository.createWorkshopBookingTransaction.mockResolvedValueOnce("CONFLICT" as any);

    await expect(
      bookingsService.createWorkshopBooking({
        requesterId: "user-1",
        workshopId: "workshop-1",
        startDate: validStart(),
        endDate: validEnd(),
        workshopToolIds: []
      })
    ).rejects.toMatchObject({ code: "BOOKING_CONFLICT", status: 409 });

    mockedBookingsRepository.createWorkshopBookingTransaction.mockResolvedValueOnce("BLOCKED" as any);

    await expect(
      bookingsService.createWorkshopBooking({
        requesterId: "user-1",
        workshopId: "workshop-1",
        startDate: validStart(),
        endDate: validEnd(),
        workshopToolIds: []
      })
    ).rejects.toMatchObject({ code: "TIMESLOT_BLOCKED", status: 409 });

    mockedBookingsRepository.createWorkshopBookingTransaction.mockResolvedValueOnce("TOOLS_INVALID" as any);

    await expect(
      bookingsService.createWorkshopBooking({
        requesterId: "user-1",
        workshopId: "workshop-1",
        startDate: validStart(),
        endDate: validEnd(),
        workshopToolIds: ["not-a-real-tool"]
      })
    ).rejects.toMatchObject({ code: "WORKSHOP_TOOLS_INVALID", status: 400 });
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

    expect(mockedBookingsRepository.updateStatus).toHaveBeenCalledWith("b1", "ACCEPTED", {
      notifyUserId: "requester-1",
      markToolAvailableId: undefined
    });
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

    const result = await bookingsService.updateBookingStatus({
      actorId: "owner-1",
      actorRole: "USER",
      bookingId: "b1",
      status: "RETURNED"
    });

    expect(mockedBookingsRepository.updateStatus).toHaveBeenCalledWith("b1", "RETURNED", {
      notifyUserId: "requester-1",
      markToolAvailableId: "tool-1"
    });
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

    expect(mockedBookingsRepository.updateStatus).toHaveBeenCalledWith("b2", "RETURNED", {
      notifyUserId: "requester-1",
      markToolAvailableId: undefined
    });
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

  it("creates an accepted owner block without sending a notification", async () => {
    mockedBookingsRepository.createToolOwnerBlockTransaction.mockResolvedValueOnce({
      id: "owner-block-1",
      userId: "owner-1",
      toolId: "tool-1",
      status: "ACCEPTED"
    } as any);

    await expect(
      bookingsService.createToolOwnerBlock({
        ownerId: "owner-1",
        toolId: "tool-1",
        startDate: "2026-07-01T09:00:00.000Z",
        endDate: "2026-07-01T12:00:00.000Z"
      })
    ).resolves.toMatchObject({ status: "ACCEPTED" });
  });

  it("returns a booking conflict when an owner block overlaps a booking", async () => {
    mockedBookingsRepository.createToolOwnerBlockTransaction.mockResolvedValueOnce("CONFLICT");

    await expect(
      bookingsService.createToolOwnerBlock({
        ownerId: "owner-1",
        toolId: "tool-1",
        startDate: "2026-07-01T09:00:00.000Z",
        endDate: "2026-07-01T12:00:00.000Z"
      })
    ).rejects.toMatchObject({
      code: "BOOKING_CONFLICT",
      status: 409
    });
  });

  it("removes self bookings from the inbox context", async () => {
    mockedBookingsRepository.listForUserContext.mockResolvedValueOnce([
      { id: "self", userId: "owner-1", tool: { ownerId: "owner-1" } },
      { id: "external", userId: "requester-2", tool: { ownerId: "owner-1" } }
    ] as any);

    await expect(bookingsService.listForUserContext("owner-1")).resolves.toEqual([
      expect.objectContaining({ id: "external" })
    ]);
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
