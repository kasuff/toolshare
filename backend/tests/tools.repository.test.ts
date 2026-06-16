import { beforeEach, describe, expect, it, vi } from "vitest";
import { toolsRepository } from "../src/modules/tools/tools.repository";

const mocks = vi.hoisted(() => ({
  toolFindMany: vi.fn(),
  toolFindUnique: vi.fn(),
  toolCreate: vi.fn(),
  toolUpdate: vi.fn(),
  toolDelete: vi.fn(),
  bookingFindFirst: vi.fn(),
  bookingFindMany: vi.fn()
}));

vi.mock("../src/config/prisma", () => ({
  prisma: {
    tool: {
      findMany: mocks.toolFindMany,
      findUnique: mocks.toolFindUnique,
      create: mocks.toolCreate,
      update: mocks.toolUpdate,
      delete: mocks.toolDelete
    },
    booking: {
      findFirst: mocks.bookingFindFirst,
      findMany: mocks.bookingFindMany
    }
  }
}));

describe("toolsRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists tools with filters and owner projection", async () => {
    mocks.toolFindMany.mockResolvedValueOnce([{ id: "t1" }]);

    const result = await toolsRepository.list({
      ownerId: "owner-1",
      status: "AVAILABLE",
      category: "elektro",
      search: "bohr"
    });

    expect(mocks.toolFindMany).toHaveBeenCalledWith({
      where: {
        ownerId: "owner-1",
        status: "AVAILABLE",
        owner: undefined,
        category: { contains: "elektro", mode: "insensitive" },
        OR: [
          { name: { contains: "bohr", mode: "insensitive" } },
          { description: { contains: "bohr", mode: "insensitive" } },
          { category: { contains: "bohr", mode: "insensitive" } },
          { pickupLocation: { contains: "bohr", mode: "insensitive" } }
        ]
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            role: true,
            isSuspended: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    expect(result).toEqual([{ id: "t1" }]);
  });

  it("excludes tools from suspended owners when requested", async () => {
    mocks.toolFindMany.mockResolvedValueOnce([]);

    await toolsRepository.list({ excludeSuspendedOwners: true });

    expect(mocks.toolFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          owner: { isSuspended: false }
        })
      })
    );
  });

  it("finds tool by id and active bookings", async () => {
    mocks.toolFindUnique.mockResolvedValueOnce({ id: "t1" });
    mocks.bookingFindFirst.mockResolvedValueOnce({ id: "b1" });

    const tool = await toolsRepository.findById("t1");
    const booking = await toolsRepository.findActiveBooking("t1");

    expect(mocks.toolFindUnique).toHaveBeenCalledWith({
      where: { id: "t1" },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            role: true,
            isSuspended: true
          }
        }
      }
    });
    expect(mocks.bookingFindFirst).toHaveBeenCalledWith({
      where: {
        toolId: "t1",
        status: { in: ["PENDING", "ACCEPTED"] }
      }
    });
    expect(tool).toEqual({ id: "t1" });
    expect(booking).toEqual({ id: "b1" });
  });

  it("lists pending and accepted blocking periods", async () => {
    mocks.bookingFindMany.mockResolvedValueOnce([
      {
        startDate: new Date("2026-07-06T09:00:00.000Z"),
        endDate: new Date("2026-07-06T12:00:00.000Z")
      }
    ]);

    await toolsRepository.listBlockingPeriods("t1");

    expect(mocks.bookingFindMany).toHaveBeenCalledWith({
      where: {
        toolId: "t1",
        status: { in: ["PENDING", "ACCEPTED"] }
      },
      select: {
        startDate: true,
        endDate: true
      },
      orderBy: { startDate: "asc" }
    });
  });

  it("creates, updates and removes tools", async () => {
    mocks.toolCreate.mockResolvedValueOnce({ id: "t2" });
    mocks.toolUpdate.mockResolvedValueOnce({ id: "t2", name: "Neu" });
    mocks.toolDelete.mockResolvedValueOnce({ id: "t2" });

    const created = await toolsRepository.create({
      ownerId: "owner-1",
      name: "Bohrer",
      description: "desc",
      category: "Elektro",
      imageUrl: "https://example.com/tool.png",
      pickupLocation: "Musterstraße 1, 80802 München, Deutschland",
      pickupLocationNote: "4. Stock"
    });
    const updated = await toolsRepository.update("t2", { name: "Neu" });
    const removed = await toolsRepository.remove("t2");

    expect(mocks.toolCreate).toHaveBeenCalledWith({
      data: {
        ownerId: "owner-1",
        name: "Bohrer",
        description: "desc",
        category: "Elektro",
        imageUrl: "https://example.com/tool.png",
        pickupLocation: "Musterstraße 1, 80802 München, Deutschland",
        pickupLocationNote: "4. Stock",
        status: "AVAILABLE"
      }
    });
    expect(mocks.toolUpdate).toHaveBeenCalledWith({
      where: { id: "t2" },
      data: { name: "Neu" }
    });
    expect(mocks.toolDelete).toHaveBeenCalledWith({ where: { id: "t2" } });
    expect(created).toEqual({ id: "t2" });
    expect(updated).toEqual({ id: "t2", name: "Neu" });
    expect(removed).toEqual({ id: "t2" });
  });
});
