import { beforeEach, describe, expect, it, vi } from "vitest";
import { toolsRepository } from "../src/modules/tools/repositories/tools.repository";
import { toolsService } from "../src/modules/tools/services/tools.service";
import type { ToolEntity } from "../src/modules/tools/entities/tools.entity";

vi.mock("../src/config/services", () => ({
  getImageStorageService: () => ({
    uploadImage: vi.fn(async (file: Buffer, mimeType: string) => `data:${mimeType};base64,${file.toString("base64")}`),
    deleteImage: vi.fn()
  })
}));

vi.mock("../src/modules/tools/repositories/tools.repository", () => ({
  toolsRepository: {
    list: vi.fn(),
    findById: vi.fn(),
    findActiveBooking: vi.fn(),
    findActiveBookingRanges: vi.fn(),
    listBlockingPeriods: vi.fn(),
    listOwnerBlocks: vi.fn(),
    deleteOwnerBlock: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn()
  }
}));

const mockedToolsRepository = vi.mocked(toolsRepository);

const sampleTool = (overrides: Partial<ToolEntity> = {}): ToolEntity => ({
  id: "t1",
  ownerId: "owner-1",
  name: "Bohrer",
  description: "desc",
  category: "Elektro",
  imageUrl: null,
  pickupLocation: "Musterstraße 1, 80802 München, Deutschland",
  pickupLocationNote: null,
  status: "AVAILABLE",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  owner: { id: "owner-1", name: "Owner", role: "USER", isSuspended: false },
  ...overrides
});

describe("toolsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists tools using repository filters", async () => {
    mockedToolsRepository.list.mockResolvedValueOnce([sampleTool()] as any);

    const result = await toolsService.list({ search: "bohr", category: "elektro" });

    expect(mockedToolsRepository.list).toHaveBeenCalledWith({
      search: "bohr",
      category: "elektro",
      excludeSuspendedOwners: true
    });
    expect(result).toMatchObject([{ id: "t1", name: "Bohrer" }]);
  });

  it("returns tool by id with merged active booking ranges", async () => {
    mockedToolsRepository.findById.mockResolvedValueOnce(sampleTool() as any);
    mockedToolsRepository.findActiveBookingRanges.mockResolvedValueOnce([
      { id: "b1", startDate: new Date(), endDate: new Date(), status: "ACCEPTED" }
    ] as any);

    const result = await toolsService.getById("t1");

    expect(mockedToolsRepository.findActiveBookingRanges).toHaveBeenCalledWith("t1");
    expect(result).toMatchObject({ id: "t1" });
    expect((result as any).bookings).toHaveLength(1);
  });

  it("hides tools from suspended owners", async () => {
    mockedToolsRepository.findById.mockResolvedValueOnce({ id: "t1", owner: { isSuspended: true } } as any);

    await expect(toolsService.getById("t1")).rejects.toMatchObject({
      code: "TOOL_NOT_FOUND",
      status: 404
    });
  });

  it("hides tools from suspended owners", async () => {
    mockedToolsRepository.findById.mockResolvedValueOnce({ id: "t1", owner: { isSuspended: true } } as any);

    await expect(toolsService.getById("t1")).rejects.toMatchObject({
      code: "TOOL_NOT_FOUND",
      status: 404
    });
  });

  it("throws for unknown tool id", async () => {
    mockedToolsRepository.findById.mockResolvedValueOnce(null);

    await expect(toolsService.getById("missing")).rejects.toMatchObject({
      code: "TOOL_NOT_FOUND",
      status: 404
    });
  });

  it("returns blocking periods for an existing tool", async () => {
    mockedToolsRepository.findById.mockResolvedValueOnce({ id: "t1", owner: { isSuspended: false } } as any);
    mockedToolsRepository.listBlockingPeriods.mockResolvedValueOnce([
      {
        startDate: new Date("2026-07-06T09:00:00.000Z"),
        endDate: new Date("2026-07-06T12:00:00.000Z")
      }
    ] as any);

    await expect(toolsService.listBlockingPeriods("t1")).resolves.toHaveLength(1);
    expect(mockedToolsRepository.listBlockingPeriods).toHaveBeenCalledWith("t1");
  });

  it("lists owner blocks for the owner", async () => {
    mockedToolsRepository.findById.mockResolvedValueOnce({ id: "t1", ownerId: "owner-1" } as any);
    mockedToolsRepository.listOwnerBlocks.mockResolvedValueOnce([
      { id: "b1", startDate: new Date(), endDate: new Date() }
    ] as any);

    const result = await toolsService.listOwnerBlocks("t1", "owner-1");

    expect(mockedToolsRepository.listOwnerBlocks).toHaveBeenCalledWith("t1", "owner-1");
    expect(result).toHaveLength(1);
  });

  it("forbids listing owner blocks for non-owners", async () => {
    mockedToolsRepository.findById.mockResolvedValueOnce({ id: "t1", ownerId: "owner-1" } as any);

    await expect(toolsService.listOwnerBlocks("t1", "other-user")).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403
    });
    expect(mockedToolsRepository.listOwnerBlocks).not.toHaveBeenCalled();
  });

  it("deletes an owner block as owner", async () => {
    mockedToolsRepository.findById.mockResolvedValueOnce({ id: "t1", ownerId: "owner-1" } as any);
    mockedToolsRepository.deleteOwnerBlock.mockResolvedValueOnce("OK" as any);

    await expect(
      toolsService.deleteOwnerBlock({ toolId: "t1", bookingId: "b1", actorId: "owner-1" })
    ).resolves.toBeUndefined();
    expect(mockedToolsRepository.deleteOwnerBlock).toHaveBeenCalledWith("b1", "owner-1");
  });

  it("forbids deleting blocks for non-owners", async () => {
    mockedToolsRepository.findById.mockResolvedValueOnce({ id: "t1", ownerId: "owner-1" } as any);

    await expect(
      toolsService.deleteOwnerBlock({ toolId: "t1", bookingId: "b1", actorId: "other-user" })
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    expect(mockedToolsRepository.deleteOwnerBlock).not.toHaveBeenCalled();
  });

  it("throws when the block to delete is missing", async () => {
    mockedToolsRepository.findById.mockResolvedValueOnce({ id: "t1", ownerId: "owner-1" } as any);
    mockedToolsRepository.deleteOwnerBlock.mockResolvedValueOnce("NOT_FOUND" as any);

    await expect(
      toolsService.deleteOwnerBlock({ toolId: "t1", bookingId: "missing", actorId: "owner-1" })
    ).rejects.toMatchObject({ code: "BLOCK_NOT_FOUND", status: 404 });
  });

  it("creates tools", async () => {
    mockedToolsRepository.create.mockResolvedValueOnce(sampleTool({ id: "t2" }) as any);

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
    mockedToolsRepository.update.mockResolvedValueOnce(sampleTool({ id: "t1", name: "Neu" }) as any);

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
    mockedToolsRepository.update.mockResolvedValueOnce(sampleTool({ id: "t1", status: "BORROWED" }) as any);

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