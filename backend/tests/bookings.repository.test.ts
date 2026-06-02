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
  txTimeSlotFindUnique: vi.fn(),
  txTimeSlotFindFirst: vi.fn(),
  txBookingFindFirst: vi.fn(),
  txBookingCreate: vi.fn(),
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

  it("lists bookings for requester and tool owner context", async () => {
    mocks.bookingFindMany.mockResolvedValueOnce([{ id: "b1" }]);

    const result = await bookingsRepository.listForUserContext("user-1");

    expect(mocks.bookingFindMany).toHaveBeenCalledWith({
      where: {
        OR: [{ userId: "user-1" }, { tool: { ownerId: "user-1" } }]
      },
      include: {
        user: true,
        tool: { include: { owner: true } },
        timeslot: { include: { workshop: { include: { manager: true } } } },
        pickupProposals: {
          orderBy: { createdAt: "asc" },
          include: { proposedBy: { select: { id: true, name: true } } }
        }
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
      include: { tool: true, timeslot: { include: { workshop: true } } }
    });
    expect(tool).toEqual({ id: "tool-1" });
    expect(booking).toEqual({ id: "booking-1" });
  });

  it("finds overlapping booking windows", async () => {
    mocks.prismaTransaction.mockImplementationOnce(async (handler: any) =>
      handler({
        tool: { findUnique: mocks.txToolFindUnique },
        booking: { findFirst: mocks.txBookingFindFirst, create: mocks.txBookingCreate }
      })
    );
    mocks.txToolFindUnique.mockResolvedValueOnce({ id: "tool-1" });
    mocks.txBookingFindFirst.mockResolvedValueOnce({ id: "booking-overlap" });
    const startDate = new Date("2026-06-01T10:00:00.000Z");
    const endDate = new Date("2026-06-01T12:00:00.000Z");

    const overlap = await bookingsRepository.createToolBookingTransaction({
      userId: "user-1",
      toolId: "tool-1",
      startDate,
      endDate,
      pickupTime: new Date("2026-06-01T09:30:00.000Z")
    });

    expect(mocks.txBookingFindFirst).toHaveBeenCalledWith({
      where: {
        toolId: "tool-1",
        status: { in: ["PENDING", "ACCEPTED"] },
        startDate: { lt: endDate },
        endDate: { gt: startDate }
      }
    });
    expect(overlap).toBe("CONFLICT");
  });

  it("creates and updates tool bookings", async () => {
    mocks.prismaTransaction.mockImplementationOnce(async (handler: any) =>
      handler({
        tool: { findUnique: mocks.txToolFindUnique },
        booking: { findFirst: mocks.txBookingFindFirst, create: mocks.txBookingCreate }
      })
    );
    mocks.txToolFindUnique.mockResolvedValueOnce({ id: "tool-1" });
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
    expect(created).toEqual({ booking: { id: "booking-created" }, tool: { id: "tool-1" } });
    expect(updated).toEqual({ id: "booking-created", status: "ACCEPTED" });
  });

  it("creates workshop booking transaction for free timeslot", async () => {
    mocks.prismaTransaction.mockImplementationOnce(async (handler: any) =>
      handler({
        tool: { findUnique: mocks.txToolFindUnique },
        timeSlot: { findUnique: mocks.txTimeSlotFindUnique, findFirst: mocks.txTimeSlotFindFirst },
        booking: { findFirst: mocks.txBookingFindFirst, create: mocks.txBookingCreate }
      })
    );
    mocks.txToolFindUnique.mockResolvedValueOnce({ id: "tool-1" });
    mocks.txTimeSlotFindUnique.mockResolvedValueOnce({
      id: "slot-1",
      startTime: new Date("2026-06-01T10:00:00.000Z"),
      endTime: new Date("2026-06-01T12:00:00.000Z")
    });
    mocks.txBookingFindFirst.mockResolvedValueOnce(null);
    mocks.txBookingCreate.mockResolvedValueOnce({ id: "booking-slot-1" });

    const result = await bookingsRepository.createWorkshopBookingTransaction({
      userId: "user-1",
      timeslotId: "slot-1"
    });

    expect(result).toEqual({ id: "booking-slot-1" });
  });

  it("returns null or conflict in workshop booking transaction", async () => {
    mocks.prismaTransaction.mockImplementationOnce(async (handler: any) =>
      handler({
        tool: { findUnique: mocks.txToolFindUnique },
        timeSlot: { findUnique: mocks.txTimeSlotFindUnique, findFirst: mocks.txTimeSlotFindFirst },
        booking: { findFirst: mocks.txBookingFindFirst, create: mocks.txBookingCreate }
      })
    );
    mocks.txTimeSlotFindUnique.mockResolvedValueOnce(null);
    const missingResult = await bookingsRepository.createWorkshopBookingTransaction({
      userId: "user-1",
      timeslotId: "missing-slot"
    });
    expect(missingResult).toBeNull();

    mocks.prismaTransaction.mockImplementationOnce(async (handler: any) =>
      handler({
        tool: { findUnique: mocks.txToolFindUnique },
        timeSlot: { findUnique: mocks.txTimeSlotFindUnique, findFirst: mocks.txTimeSlotFindFirst },
        booking: { findFirst: mocks.txBookingFindFirst, create: mocks.txBookingCreate }
      })
    );
    mocks.txTimeSlotFindUnique.mockResolvedValueOnce({
      id: "slot-1",
      startTime: new Date("2026-06-01T10:00:00.000Z"),
      endTime: new Date("2026-06-01T12:00:00.000Z")
    });
    mocks.txBookingFindFirst.mockResolvedValueOnce({ id: "existing" });

    const conflictResult = await bookingsRepository.createWorkshopBookingTransaction({
      userId: "user-1",
      timeslotId: "slot-1"
    });
    expect(conflictResult).toBe("CONFLICT");
  });
});
