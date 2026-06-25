import { beforeEach, describe, expect, it, vi } from "vitest";
import { bookingsRepository } from "../src/modules/bookings/bookings.repository";

const mocks = vi.hoisted(() => ({
  bookingFindMany: vi.fn(),
  toolFindUnique: vi.fn(),
  toolUpdate: vi.fn(),
  bookingFindUnique: vi.fn(),
  bookingFindFirst: vi.fn(),
  bookingUpdate: vi.fn(),
  txToolFindUnique: vi.fn(),
  txWorkshopFindUnique: vi.fn(),
  txTimeSlotFindFirst: vi.fn(),
  txBookingFindFirst: vi.fn(),
  txWorkshopToolFindMany: vi.fn(),
  txBookingCreate: vi.fn(),
  txBookingUpdate: vi.fn(),
  txToolUpdate: vi.fn(),
  txBookingFindUnique: vi.fn(),
  txBookingSelectedToolCreateMany: vi.fn(),
  txOutboxEventCreate: vi.fn(),
  prismaTransaction: vi.fn()
}));

vi.mock("../src/config/prisma", () => ({
  prisma: {
    booking: {
      findMany: mocks.bookingFindMany,
      findUnique: mocks.bookingFindUnique,
      findFirst: mocks.bookingFindFirst,
      update: mocks.bookingUpdate
    },
    tool: {
      findUnique: mocks.toolFindUnique,
      update: mocks.toolUpdate
    },
    $transaction: mocks.prismaTransaction
  }
}));

describe("bookingsRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupToolBookingTx = () => {
    mocks.prismaTransaction.mockImplementationOnce(async (handler: any) =>
      handler({
        tool: { findUnique: mocks.txToolFindUnique },
        booking: { findFirst: mocks.txBookingFindFirst, create: mocks.txBookingCreate },
        outboxEvent: { create: mocks.txOutboxEventCreate }
      })
    );
  };

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
        bookingSelectedTool: { createMany: mocks.txBookingSelectedToolCreateMany },
        outboxEvent: { create: mocks.txOutboxEventCreate }
      })
    );
  };

  it("lists bookings for requester, tool owner and workshop manager context", async () => {
    mocks.bookingFindMany.mockResolvedValueOnce([{ id: "b1" }]);

    const result = await bookingsRepository.listForUserContext("user-1");

    expect(mocks.bookingFindMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { userId: "user-1" },
          { tool: { ownerId: "user-1" } },
          { workshop: { managerId: "user-1" } },
          { timeslot: { workshop: { managerId: "user-1" } } }
        ]
      },
      include: {
        user: { select: { id: true, name: true } },
        tool: { include: { owner: { select: { id: true, name: true } } } },
        workshop: { include: { manager: { select: { id: true, name: true } } } },
        timeslot: { include: { workshop: { include: { manager: { select: { id: true, name: true } } } } } },
        selectedTools: { include: { workshopTool: true } },
        pickupProposals: {
          orderBy: { createdAt: "asc" },
          take: 100,
          include: { proposedBy: { select: { id: true, name: true } } }
        },
        timeslotProposals: {
          orderBy: { createdAt: "asc" },
          take: 100,
          include: { proposedBy: { select: { id: true, name: true } } }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 100
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
        workshop: true,
        timeslot: { include: { workshop: true } },
        selectedTools: { include: { workshopTool: true } }
      }
    });
    expect(tool).toEqual({ id: "tool-1" });
    expect(booking).toEqual({ id: "booking-1" });
  });

  it("creates tool bookings, updates status and releases tools", async () => {
    setupToolBookingTx();
    mocks.txToolFindUnique.mockResolvedValueOnce({ id: "tool-1", ownerId: "owner-1" });
    mocks.txBookingFindFirst.mockResolvedValueOnce(null);
    mocks.txBookingCreate.mockResolvedValueOnce({ id: "booking-created" });
    mocks.txOutboxEventCreate.mockResolvedValue({ id: "outbox-1" });

    mocks.prismaTransaction.mockImplementationOnce(async (handler: any) =>
      handler({
        booking: { update: mocks.txBookingUpdate },
        tool: { update: mocks.txToolUpdate },
        outboxEvent: { create: mocks.txOutboxEventCreate }
      })
    );
    mocks.txBookingUpdate.mockResolvedValueOnce({ id: "booking-created", status: "ACCEPTED" });
    mocks.toolUpdate.mockResolvedValueOnce({ id: "tool-1", status: "AVAILABLE" });

    const created = await bookingsRepository.createToolBookingTransaction({
      userId: "user-1",
      toolId: "tool-1",
      startDate: new Date("2026-06-01T10:00:00.000Z"),
      endDate: new Date("2026-06-01T12:00:00.000Z"),
      pickupTime: new Date("2026-06-01T09:30:00.000Z")
    });
    const updated = await bookingsRepository.updateStatus("booking-created", "ACCEPTED");
    const released = await bookingsRepository.markToolAvailable("tool-1");

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
    expect(mocks.txBookingUpdate).toHaveBeenCalledWith({
      where: { id: "booking-created" },
      data: { status: "ACCEPTED" }
    });
    expect(mocks.toolUpdate).toHaveBeenCalledWith({
      where: { id: "tool-1" },
      data: { status: "AVAILABLE" }
    });
    expect(created).toEqual({
      booking: { id: "booking-created" },
      tool: { id: "tool-1", ownerId: "owner-1" }
    });
    expect(updated).toEqual({ id: "booking-created", status: "ACCEPTED" });
    expect(released).toEqual({ id: "tool-1", status: "AVAILABLE" });
  });

  it("returns null or conflict in tool booking transaction", async () => {
    setupToolBookingTx();
    mocks.txToolFindUnique.mockResolvedValueOnce(null);

    const missingToolResult = await bookingsRepository.createToolBookingTransaction({
      userId: "user-1",
      toolId: "missing-tool",
      startDate: new Date("2026-06-01T10:00:00.000Z"),
      endDate: new Date("2026-06-01T12:00:00.000Z"),
      pickupTime: new Date("2026-06-01T09:30:00.000Z")
    });

    expect(missingToolResult).toBeNull();

    setupToolBookingTx();
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

  it("rejects an owner block that overlaps an accepted booking", async () => {
    setupToolBookingTx();
    mocks.txToolFindUnique.mockResolvedValueOnce({ id: "tool-1", ownerId: "owner-1" });
    mocks.txBookingFindFirst.mockResolvedValueOnce({
      id: "accepted-booking",
      status: "ACCEPTED"
    });

    const startDate = new Date("2026-07-01T10:00:00.000Z");
    const endDate = new Date("2026-07-01T12:00:00.000Z");
    const result = await bookingsRepository.createToolOwnerBlockTransaction({
      ownerId: "owner-1",
      toolId: "tool-1",
      startDate,
      endDate
    });

    expect(result).toBe("CONFLICT");
    expect(mocks.txBookingFindFirst).toHaveBeenCalledWith({
      where: {
        toolId: "tool-1",
        status: { in: ["PENDING", "ACCEPTED"] },
        startDate: { lt: endDate },
        endDate: { gt: startDate }
      }
    });
    expect(mocks.txBookingCreate).not.toHaveBeenCalled();
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
});
