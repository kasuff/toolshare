import { beforeEach, describe, expect, it, vi } from "vitest";
import { workshopsRepository } from "../src/modules/workshops/workshops.repository";

const mocks = vi.hoisted(() => ({
  workshopFindMany: vi.fn(),
  workshopFindUnique: vi.fn(),
  workshopCreate: vi.fn(),
  workshopDelete: vi.fn(),
  txWorkshopToolDeleteMany: vi.fn(),
  txWorkshopUpdate: vi.fn(),
  timeSlotFindFirst: vi.fn(),
  timeSlotCreate: vi.fn(),
  timeSlotFindUnique: vi.fn(),
  timeSlotDelete: vi.fn(),
  bookingFindFirst: vi.fn(),
  bookingFindMany: vi.fn(),
  prismaTransaction: vi.fn()
}));

vi.mock("../src/config/prisma", () => ({
  prisma: {
    workshop: {
      findMany: mocks.workshopFindMany,
      findUnique: mocks.workshopFindUnique,
      create: mocks.workshopCreate,
      delete: mocks.workshopDelete
    },
    timeSlot: {
      findFirst: mocks.timeSlotFindFirst,
      create: mocks.timeSlotCreate,
      findUnique: mocks.timeSlotFindUnique,
      delete: mocks.timeSlotDelete
    },
    booking: {
      findFirst: mocks.bookingFindFirst,
      findMany: mocks.bookingFindMany
    },
    $transaction: mocks.prismaTransaction
  }
}));

describe("workshopsRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists workshops with filters and manager projection", async () => {
    mocks.workshopFindMany.mockResolvedValueOnce([{ id: "w1" }]);

    const result = await workshopsRepository.list({
      managerId: "manager-1",
      location: "muenchen",
      search: "holz"
    });

    expect(mocks.workshopFindMany).toHaveBeenCalledWith({
      where: {
        managerId: "manager-1",
        location: { contains: "muenchen", mode: "insensitive" },
        OR: [
          { name: { contains: "holz", mode: "insensitive" } },
          { description: { contains: "holz", mode: "insensitive" } },
          { location: { contains: "holz", mode: "insensitive" } }
        ]
      },
      include: {
        manager: {
          select: {
            id: true,
            name: true
          }
        },
        workshopTools: {
          select: {
            id: true,
            name: true,
            category: true
          }
        }
      },
      orderBy: { name: "asc" }
    });
    expect(result).toEqual([{ id: "w1" }]);
  });

  it("loads workshop details by id", async () => {
    mocks.workshopFindUnique.mockResolvedValueOnce({ id: "w1" });

    const result = await workshopsRepository.findById("w1");

    expect(mocks.workshopFindUnique).toHaveBeenCalledWith({
      where: { id: "w1" },
      include: {
        manager: {
          select: {
            id: true,
            name: true
          }
        },
        workshopTools: {
          select: {
            id: true,
            name: true,
            category: true
          }
        },
        timeslots: {
          orderBy: { startTime: "asc" }
        }
      }
    });
    expect(result).toEqual({ id: "w1" });
  });

  it("loads active booking ranges via direct and legacy timeslot links", async () => {
    mocks.bookingFindMany.mockResolvedValueOnce([{ id: "b1" }]);

    const result = await workshopsRepository.findActiveBookingRanges("w1");

    expect(mocks.bookingFindMany).toHaveBeenCalledWith({
      where: {
        status: { in: ["PENDING", "ACCEPTED"] },
        OR: [{ workshopId: "w1" }, { timeslot: { workshopId: "w1" } }]
      },
      select: { id: true, startDate: true, endDate: true, status: true },
      orderBy: { startDate: "asc" }
    });
    expect(result).toEqual([{ id: "b1" }]);
  });

  it("creates, updates and removes workshops", async () => {
    mocks.workshopCreate.mockResolvedValueOnce({ id: "w2", workshopTools: [] });
    mocks.prismaTransaction.mockImplementationOnce(async (handler: any) =>
      handler({
        workshopTool: { deleteMany: mocks.txWorkshopToolDeleteMany },
        workshop: { update: mocks.txWorkshopUpdate }
      })
    );
    mocks.txWorkshopToolDeleteMany.mockResolvedValueOnce({ count: 1 });
    mocks.txWorkshopUpdate.mockResolvedValueOnce({ id: "w2", name: "Neu", workshopTools: [] });
    mocks.workshopDelete.mockResolvedValueOnce({ id: "w2" });

    const created = await workshopsRepository.create({
      managerId: "manager-1",
      name: "Werkstatt",
      description: "desc",
      location: "Muenchen",
      maxCapacity: 4,
      extras: ["WLAN"],
      workshopTools: [{ name: "Akkuschrauber", category: "elektro" }],
      imageUrls: ["https://example.com/workshop.png"]
    });
    const updated = await workshopsRepository.update("w2", {
      name: "Neu",
      extras: ["Starkstrom"],
      workshopTools: [{ name: "Stichsaege", category: "holz" }]
    });
    const removed = await workshopsRepository.remove("w2");

    expect(mocks.workshopCreate).toHaveBeenCalledWith({
      data: {
        managerId: "manager-1",
        name: "Werkstatt",
        description: "desc",
        location: "Muenchen",
        maxCapacity: 4,
        equipment: ["WLAN"],
        imageUrls: ["https://example.com/workshop.png"],
        workshopTools: {
          create: [{ name: "Akkuschrauber", category: "elektro" }]
        }
      },
      include: {
        workshopTools: {
          select: {
            id: true,
            name: true,
            category: true
          }
        }
      }
    });
    expect(mocks.txWorkshopToolDeleteMany).toHaveBeenCalledWith({
      where: { workshopId: "w2" }
    });
    expect(mocks.txWorkshopUpdate).toHaveBeenCalledWith({
      where: { id: "w2" },
      data: {
        name: "Neu",
        equipment: ["Starkstrom"],
        workshopTools: {
          create: [{ name: "Stichsaege", category: "holz" }]
        }
      },
      include: {
        workshopTools: {
          select: {
            id: true,
            name: true,
            category: true
          }
        }
      }
    });
    expect(mocks.workshopDelete).toHaveBeenCalledWith({ where: { id: "w2" } });
    expect(created).toMatchObject({ id: "w2" });
    expect(updated).toMatchObject({ id: "w2", name: "Neu" });
    expect(removed).toEqual({ id: "w2" });
  });

  it("handles timeslot queries and mutations", async () => {
    const startTime = new Date("2026-06-01T10:00:00.000Z");
    const endTime = new Date("2026-06-01T12:00:00.000Z");
    mocks.timeSlotFindFirst.mockResolvedValueOnce({ id: "slot-overlap" });
    mocks.timeSlotCreate.mockResolvedValueOnce({ id: "slot-1" });
    mocks.timeSlotFindUnique.mockResolvedValueOnce({ id: "slot-1" });
    mocks.bookingFindFirst.mockResolvedValueOnce({ id: "booking-1" });
    mocks.timeSlotDelete.mockResolvedValueOnce({ id: "slot-1" });

    const overlap = await workshopsRepository.findOverlappingTimeslot("w1", startTime, endTime);
    const created = await workshopsRepository.createTimeslot({
      workshopId: "w1",
      startTime,
      endTime,
      blockedByOwner: false
    });
    const found = await workshopsRepository.findTimeslotById("slot-1");
    const activeBooking = await workshopsRepository.findActiveBookingForTimeslot("slot-1");
    const removed = await workshopsRepository.removeTimeslot("slot-1");

    expect(overlap).toEqual({ id: "slot-overlap" });
    expect(created).toEqual({ id: "slot-1" });
    expect(found).toEqual({ id: "slot-1" });
    expect(activeBooking).toEqual({ id: "booking-1" });
    expect(removed).toEqual({ id: "slot-1" });
  });
});
