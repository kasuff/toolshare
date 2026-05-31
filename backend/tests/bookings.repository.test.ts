import { beforeEach, describe, expect, it, vi } from "vitest";
import { bookingsRepository } from "../src/modules/bookings/bookings.repository";

const mocks = vi.hoisted(() => ({
  bookingFindMany: vi.fn(),
  toolFindUnique: vi.fn(),
  bookingFindUnique: vi.fn(),
  bookingFindFirst: vi.fn(),
  bookingCreate: vi.fn(),
  bookingUpdate: vi.fn(),
  txToolFindUnique: vi.fn(),
  txWorkshopFindUnique: vi.fn(),
  txTimeSlotFindFirst: vi.fn(),
  txBookingFindFirst: vi.fn(),
  txWorkshopToolFindMany: vi.fn(),
  txBookingCreate: vi.fn(),
  txBookingFindUnique: vi.fn(),
  txBookingSelectedToolCreateMany: vi.fn(),
  prismaTransaction: vi.fn()
}));

vi.mock("../src/config/prisma", () => ({
  prisma: {
    booking: {
      findMany: mocks.bookingFindMany,
      findUnique: mocks.bookingFindUnique,
      findFirst: mocks.bookingFindFirst,
      create: mocks.bookingCreate,
      update: mocks.bookingUpdate
    },
    tool: {
      findUnique: mocks.toolFindUnique
    },
    $transaction: mocks.prismaTransaction
  }
}));

describe("bookingsRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupWorkshopBookingTx = () => {
    mocks.prismaTransaction.mockImplementationOnce(async (handler: any) =>
      handler({
        workshop: { findUnique: mocks.txWorkshopFindUnique },
        timeSlot: { findFirst: mocks.txTimeSlotFindFirst },
        booking: {
          findFirst: mocks.txBookingFindFirst,
          create: mocks.txBookingCreate,
          findUnique: mocks.txBookingFindUnique
        },
        workshopTool: { findMany: mocks.txWorkshopToolFindMany },
        bookingSelectedTool: { createMany: mocks.txBookingSelectedToolCreateMany }
      })
    );
  };

  it("lists bookings for requester, owner and workshop manager context", async () => {
    mocks.bookingFindMany.mockResolvedValueOnce([{ id: "b1" }]);

    const result = await bookingsRepository.listForUserContext("user-1");

    expect(mocks.bookingFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.bookingFindMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        OR: [
          { userId: "user-1" },
          { tool: { ownerId: "user-1" } },
          { timeslot: { workshop: { managerId: "user-1" } } }
        ]
      },
      include: {
        user: true,
        tool: { include: { owner: true } },
        timeslot: { include: { workshop: { include: { manager: true } } } },
        selectedTools: { include: { workshopTool: true } },
        pickupProposals: { orderBy: { createdAt: "asc" } },
        timeslotProposals: { orderBy: { createdAt: "asc" } }
      },
      orderBy: { startDate: "desc" }
    });
    expect(result).toEqual([{ id: "b1" }]);
  });

  it("finds tool and booking entities by id", async () => {
    mocks.toolFindUnique.mockResolvedValueOnce({ id: "tool-1" });
    mocks.bookingFindUnique.mockResolvedValueOnce({ id: "booking-1" });

    const tool = await bookingsRepository.findToolById("tool-1");
    const booking = await bookingsRepository.findBookingById("booking-1");

    expect(mocks.toolFindUnique).toHaveBeenCalledWith({ where: { id: "tool-1" } });
    expect(mocks.bookingFindUnique).toHaveBeenCalledWith({
      where: { id: "booking-1" },
      include: {
        tool: true,
        timeslot: { include: { workshop: true } },
        selectedTools: { include: { workshopTool: true } }
      }
    });
    expect(tool).toEqual({ id: "tool-1" });
    expect(booking).toEqual({ id: "booking-1" });
  });

  it("creates tool booking transaction and updates booking status", async () => {
    mocks.prismaTransaction.mockImplementationOnce(async (handler: any) =>
      handler({
        tool: { findUnique: mocks.txToolFindUnique },
        booking: { findFirst: mocks.txBookingFindFirst, create: mocks.txBookingCreate }
      })
    );
    mocks.txToolFindUnique.mockResolvedValueOnce({ id: "tool-1", ownerId: "owner-1" });
    mocks.txBookingFindFirst.mockResolvedValueOnce(null);
    mocks.txBookingCreate.mockResolvedValueOnce({ id: "booking-created" });
    mocks.bookingUpdate.mockResolvedValueOnce({ id: "booking-created", status: "ACCEPTED" });

    const created = await bookingsRepository.createToolBookingTransaction({
      userId: "user-1",
      toolId: "tool-1",
      startDate: new Date("2026-06-01T10:00:00.000Z"),
      endDate: new Date("2026-06-01T12:00:00.000Z"),
      pickupTime: new Date("2026-06-01T09:30:00.000Z")
    });
    const updated = await bookingsRepository.updateStatus("booking-created", "ACCEPTED");

    expect(mocks.txBookingCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        toolId: "tool-1",
        startDate: new Date("2026-06-01T10:00:00.000Z"),
        endDate: new Date("2026-06-01T12:00:00.000Z"),
        pickupTime: new Date("2026-06-01T09:30:00.000Z"),
        status: "PENDING"
      }
    });
    expect(mocks.bookingUpdate).toHaveBeenCalledWith({
      where: { id: "booking-created" },
      data: { status: "ACCEPTED" }
    });
    expect(created).toEqual({
      booking: { id: "booking-created" },
      tool: { id: "tool-1", ownerId: "owner-1" }
    });
    expect(updated).toEqual({ id: "booking-created", status: "ACCEPTED" });
  });

  it("returns null or conflict in tool booking transaction", async () => {
    mocks.prismaTransaction.mockImplementationOnce(async (handler: any) =>
      handler({
        tool: { findUnique: mocks.txToolFindUnique },
        booking: { findFirst: mocks.txBookingFindFirst, create: mocks.txBookingCreate }
      })
    );
    mocks.txToolFindUnique.mockResolvedValueOnce(null);
    const missingToolResult = await bookingsRepository.createToolBookingTransaction({
      userId: "user-1",
      toolId: "missing-tool",
      startDate: new Date("2026-06-01T10:00:00.000Z"),
      endDate: new Date("2026-06-01T12:00:00.000Z"),
      pickupTime: new Date("2026-06-01T09:30:00.000Z")
    });
    expect(missingToolResult).toBeNull();

    mocks.prismaTransaction.mockImplementationOnce(async (handler: any) =>
      handler({
        tool: { findUnique: mocks.txToolFindUnique },
        booking: { findFirst: mocks.txBookingFindFirst, create: mocks.txBookingCreate }
      })
    );
    mocks.txToolFindUnique.mockResolvedValueOnce({ id: "tool-1", ownerId: "owner-1" });
    mocks.txBookingFindFirst.mockResolvedValueOnce({ id: "existing-overlap" });
    const conflictResult = await bookingsRepository.createToolBookingTransaction({
      userId: "user-1",
      toolId: "tool-1",
      startDate: new Date("2026-06-01T10:00:00.000Z"),
      endDate: new Date("2026-06-01T12:00:00.000Z"),
      pickupTime: new Date("2026-06-01T09:30:00.000Z")
    });
    expect(conflictResult).toBe("CONFLICT");
  });

  it("creates workshop booking transaction for available range", async () => {
    setupWorkshopBookingTx();
    mocks.txWorkshopFindUnique.mockResolvedValueOnce({ id: "workshop-1", managerId: "manager-1" });
    mocks.txTimeSlotFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "slot-available",
        workshopId: "workshop-1",
        startTime: new Date("2026-06-01T10:00:00.000Z"),
        endTime: new Date("2026-06-05T10:00:00.000Z"),
        blockedByOwner: false
      });
    mocks.txBookingFindFirst.mockResolvedValueOnce(null);
    mocks.txWorkshopToolFindMany.mockResolvedValueOnce([{ id: "wt-1", workshopId: "workshop-1" }]);
    mocks.txBookingCreate.mockResolvedValueOnce({ id: "booking-slot-1" });
    mocks.txBookingSelectedToolCreateMany.mockResolvedValueOnce({ count: 1 });
    mocks.txBookingFindUnique.mockResolvedValueOnce({ id: "booking-slot-1" });

    const result = await bookingsRepository.createWorkshopBookingTransaction({
      userId: "user-1",
      workshopId: "workshop-1",
      startDate: new Date("2026-06-02T10:00:00.000Z"),
      endDate: new Date("2026-06-03T10:00:00.000Z"),
      workshopToolIds: ["wt-1"]
    });

    expect(result).toEqual({ id: "booking-slot-1" });
    expect(mocks.txBookingSelectedToolCreateMany).toHaveBeenCalledWith({
      data: [{ bookingId: "booking-slot-1", workshopToolId: "wt-1" }]
    });
  });

  it("handles workshop booking transaction edge cases", async () => {
    setupWorkshopBookingTx();
    const toolsRequiredResult = await bookingsRepository.createWorkshopBookingTransaction({
      userId: "user-1",
      workshopId: "workshop-1",
      startDate: new Date("2026-06-01T10:00:00.000Z"),
      endDate: new Date("2026-06-02T10:00:00.000Z"),
      workshopToolIds: []
    });
    expect(toolsRequiredResult).toBe("TOOLS_REQUIRED");

    setupWorkshopBookingTx();
    mocks.txWorkshopFindUnique.mockResolvedValueOnce(null);
    const missingResult = await bookingsRepository.createWorkshopBookingTransaction({
      userId: "user-1",
      workshopId: "missing-workshop",
      startDate: new Date("2026-06-01T10:00:00.000Z"),
      endDate: new Date("2026-06-02T10:00:00.000Z"),
      workshopToolIds: ["wt-1"]
    });
    expect(missingResult).toBe("WORKSHOP_NOT_FOUND");

    setupWorkshopBookingTx();
    mocks.txWorkshopFindUnique.mockResolvedValueOnce({ id: "workshop-1", managerId: "manager-1" });
    mocks.txTimeSlotFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const outsideAvailabilityResult = await bookingsRepository.createWorkshopBookingTransaction({
      userId: "user-1",
      workshopId: "workshop-1",
      startDate: new Date("2026-06-01T10:00:00.000Z"),
      endDate: new Date("2026-06-02T10:00:00.000Z"),
      workshopToolIds: ["wt-1"]
    });
    expect(outsideAvailabilityResult).toBe("OUTSIDE_AVAILABILITY");

    setupWorkshopBookingTx();
    mocks.txWorkshopFindUnique.mockResolvedValueOnce({ id: "workshop-1", managerId: "manager-1" });
    mocks.txTimeSlotFindFirst.mockResolvedValueOnce({ id: "blocked-slot" });
    const blockedResult = await bookingsRepository.createWorkshopBookingTransaction({
      userId: "user-1",
      workshopId: "workshop-1",
      startDate: new Date("2026-06-02T10:00:00.000Z"),
      endDate: new Date("2026-06-03T10:00:00.000Z"),
      workshopToolIds: ["wt-1"]
    });
    expect(blockedResult).toBe("BLOCKED");

    setupWorkshopBookingTx();
    mocks.txWorkshopFindUnique.mockResolvedValueOnce({ id: "workshop-1", managerId: "manager-1" });
    mocks.txTimeSlotFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "slot-available",
        workshopId: "workshop-1",
        startTime: new Date("2026-06-01T10:00:00.000Z"),
        endTime: new Date("2026-06-05T10:00:00.000Z"),
        blockedByOwner: false
      });
    mocks.txBookingFindFirst.mockResolvedValueOnce({ id: "existing" });
    const conflictResult = await bookingsRepository.createWorkshopBookingTransaction({
      userId: "user-1",
      workshopId: "workshop-1",
      startDate: new Date("2026-06-02T10:00:00.000Z"),
      endDate: new Date("2026-06-03T10:00:00.000Z"),
      workshopToolIds: ["wt-1"]
    });
    expect(conflictResult).toBe("CONFLICT");

    setupWorkshopBookingTx();
    mocks.txWorkshopFindUnique.mockResolvedValueOnce({ id: "workshop-1", managerId: "manager-1" });
    mocks.txTimeSlotFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "slot-available",
        workshopId: "workshop-1",
        startTime: new Date("2026-06-01T10:00:00.000Z"),
        endTime: new Date("2026-06-05T10:00:00.000Z"),
        blockedByOwner: false
      });
    mocks.txBookingFindFirst.mockResolvedValueOnce(null);
    mocks.txWorkshopToolFindMany.mockResolvedValueOnce([]);
    const invalidToolsResult = await bookingsRepository.createWorkshopBookingTransaction({
      userId: "user-1",
      workshopId: "workshop-1",
      startDate: new Date("2026-06-02T10:00:00.000Z"),
      endDate: new Date("2026-06-03T10:00:00.000Z"),
      workshopToolIds: ["missing-tool"]
    });
    expect(invalidToolsResult).toBe("TOOLS_INVALID");
  });
});
