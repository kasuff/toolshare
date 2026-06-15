import { beforeEach, describe, expect, it, vi } from "vitest";
import { toolsRepository } from "../src/modules/tools/tools.repository";
import { toolsService } from "../src/modules/tools/tools.service";

vi.mock("../src/modules/tools/tools.repository", () => ({
  toolsRepository: {
    list: vi.fn(),
    findById: vi.fn(),
    findActiveBooking: vi.fn(),
    listBlockingPeriods: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn()
  }
}));

const mockedToolsRepository = vi.mocked(toolsRepository);

describe("toolsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists tools using repository filters", async () => {
    mockedToolsRepository.list.mockResolvedValueOnce([{ id: "t1" }] as any);

    const result = await toolsService.list({ search: "bohr", category: "elektro" });

    expect(mockedToolsRepository.list).toHaveBeenCalledWith({ search: "bohr", category: "elektro" });
    expect(result).toEqual([{ id: "t1" }]);
  });

  it("returns tool by id", async () => {
    mockedToolsRepository.findById.mockResolvedValueOnce({ id: "t1" } as any);

    const result = await toolsService.getById("t1");

    expect(result).toMatchObject({ id: "t1" });
  });

  it("throws for unknown tool id", async () => {
    mockedToolsRepository.findById.mockResolvedValueOnce(null);

    await expect(toolsService.getById("missing")).rejects.toMatchObject({
      code: "TOOL_NOT_FOUND",
      status: 404
    });
  });

  it("returns blocking periods for an existing tool", async () => {
    mockedToolsRepository.findById.mockResolvedValueOnce({ id: "t1" } as any);
    mockedToolsRepository.listBlockingPeriods.mockResolvedValueOnce([
      {
        startDate: new Date("2026-07-06T09:00:00.000Z"),
        endDate: new Date("2026-07-06T12:00:00.000Z")
      }
    ] as any);

    await expect(toolsService.listBlockingPeriods("t1")).resolves.toHaveLength(1);
    expect(mockedToolsRepository.listBlockingPeriods).toHaveBeenCalledWith("t1");
  });

  it("creates tools", async () => {
    mockedToolsRepository.create.mockResolvedValueOnce({ id: "t2" } as any);

    const result = await toolsService.create({
      ownerId: "u1",
      name: "Bohrer",
      description: "desc",
      category: "Elektro",
      pickupLocation: "Musterstraße 1, 80802 München, Deutschland",
      pickupLocationNote: "Bei Thomas klingeln"
    });

    expect(mockedToolsRepository.create).toHaveBeenCalled();
    expect(result).toMatchObject({ id: "t2" });
  });

  it("updates tools as owner", async () => {
    mockedToolsRepository.findById.mockResolvedValueOnce({ id: "t1", ownerId: "owner-1" } as any);
    mockedToolsRepository.update.mockResolvedValueOnce({ id: "t1", name: "Neu" } as any);

    const result = await toolsService.update({
      toolId: "t1",
      actorId: "owner-1",
      actorRole: "USER",
      data: { name: "Neu" }
    });

    expect(mockedToolsRepository.update).toHaveBeenCalledWith("t1", { name: "Neu" });
    expect(result).toMatchObject({ id: "t1", name: "Neu" });
  });

  it("blocks tool updates for unauthorized user roles", async () => {
    mockedToolsRepository.findById.mockResolvedValueOnce({ id: "t1", ownerId: "owner-1" } as any);

    await expect(
      toolsService.update({
        toolId: "t1",
        actorId: "other-user",
        actorRole: "USER",
        data: { name: "Neu" }
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("allows moderators to update tools", async () => {
    mockedToolsRepository.findById.mockResolvedValueOnce({ id: "t1", ownerId: "owner-1" } as any);
    mockedToolsRepository.update.mockResolvedValueOnce({ id: "t1", status: "BORROWED" } as any);

    const result = await toolsService.update({
      toolId: "t1",
      actorId: "mod-1",
      actorRole: "MODERATOR",
      data: { status: "BORROWED" }
    });

    expect(result).toMatchObject({ id: "t1", status: "BORROWED" });
  });

  it("removes tools when no active booking exists", async () => {
    mockedToolsRepository.findById.mockResolvedValueOnce({ id: "t1", ownerId: "owner-1" } as any);
    mockedToolsRepository.findActiveBooking.mockResolvedValueOnce(null);

    await toolsService.remove({
      toolId: "t1",
      actorId: "owner-1",
      actorRole: "USER"
    });

    expect(mockedToolsRepository.remove).toHaveBeenCalledWith("t1");
  });

  it("rejects removing tools with active bookings", async () => {
    mockedToolsRepository.findById.mockResolvedValueOnce({ id: "t1", ownerId: "owner-1" } as any);
    mockedToolsRepository.findActiveBooking.mockResolvedValueOnce({ id: "b1" } as any);

    await expect(
      toolsService.remove({
        toolId: "t1",
        actorId: "owner-1",
        actorRole: "USER"
      })
    ).rejects.toMatchObject({ code: "ACTIVE_BOOKING_EXISTS", status: 409 });
  });

  it("rejects removing tools for unauthorized actors", async () => {
    mockedToolsRepository.findById.mockResolvedValueOnce({ id: "t1", ownerId: "owner-1" } as any);

    await expect(
      toolsService.remove({
        toolId: "t1",
        actorId: "other-user",
        actorRole: "USER"
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});
