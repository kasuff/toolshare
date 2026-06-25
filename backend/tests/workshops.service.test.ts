import { beforeEach, describe, expect, it, vi } from "vitest";
import { workshopsRepository } from "../src/modules/workshops/workshops.repository";
import { workshopsService } from "../src/modules/workshops/workshops.service";

vi.mock("../src/modules/workshops/workshops.repository", () => ({
  workshopsRepository: {
    list: vi.fn(),
    findById: vi.fn(),
    findActiveBookingRanges: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    findActiveBooking: vi.fn(),
    findOverlappingTimeslot: vi.fn(),
    createTimeslot: vi.fn(),
    createBlockedTimeslotWithAvailabilitySplit: vi.fn(),
    findTimeslotById: vi.fn(),
    updateTimeslot: vi.fn(),
    findActiveBookingForTimeslot: vi.fn(),
    removeTimeslot: vi.fn()
  }
}));

const mockedWorkshopsRepository = vi.mocked(workshopsRepository);

describe("workshopsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists workshops with filters", async () => {
    mockedWorkshopsRepository.list.mockResolvedValueOnce([{ id: "w1" }] as any);

    const result = await workshopsService.list({ search: "holz" });

    expect(mockedWorkshopsRepository.list).toHaveBeenCalledWith({
      search: "holz",
      excludeSuspendedManagers: true
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("w1");
  });

  it("returns workshop by id with merged active booking ranges", async () => {
    mockedWorkshopsRepository.findById.mockResolvedValueOnce({ id: "w1", manager: { isSuspended: false } } as any);
    mockedWorkshopsRepository.findActiveBookingRanges.mockResolvedValueOnce([
      { id: "b1", startDate: new Date(), endDate: new Date(), status: "ACCEPTED" }
    ] as any);

    const result = await workshopsService.getById("w1");

    expect(mockedWorkshopsRepository.findActiveBookingRanges).toHaveBeenCalledWith("w1");
    expect(result).toMatchObject({ id: "w1" });
    expect((result as any).bookings).toHaveLength(1);
  });

  it("hides workshops from suspended managers", async () => {
    mockedWorkshopsRepository.findById.mockResolvedValueOnce({ id: "w1", manager: { isSuspended: true } } as any);

    await expect(workshopsService.getById("w1")).rejects.toMatchObject({
      code: "WORKSHOP_NOT_FOUND",
      status: 404
    });
  });

  it("hides workshops from suspended managers", async () => {
    mockedWorkshopsRepository.findById.mockResolvedValueOnce({ id: "w1", manager: { isSuspended: true } } as any);

    await expect(workshopsService.getById("w1")).rejects.toMatchObject({
      code: "WORKSHOP_NOT_FOUND",
      status: 404
    });
  });

  it("throws when workshop is missing", async () => {
    mockedWorkshopsRepository.findById.mockResolvedValueOnce(null);

    await expect(workshopsService.getById("missing")).rejects.toMatchObject({
      code: "WORKSHOP_NOT_FOUND",
      status: 404
    });
  });

  it("creates workshop", async () => {
    mockedWorkshopsRepository.create.mockResolvedValueOnce({ id: "w2" } as any);

    const result = await workshopsService.create({
      managerId: "u1",
      name: "Werkstatt",
      description: "desc",
      location: "Muenchen",
      maxCapacity: 4
    });

    expect(mockedWorkshopsRepository.create).toHaveBeenCalled();
    expect(result).toMatchObject({ id: "w2" });
  });

  it("fills optional extras, tools and photos with defaults on create", async () => {
    mockedWorkshopsRepository.create.mockResolvedValueOnce({ id: "w2" } as any);

    await workshopsService.create({
      managerId: "u1",
      name: "Werkstatt",
      description: "desc",
      location: "Muenchen",
      maxCapacity: 4
    });

    // objectContaining: die geocodeten latitude/longitude werden zusätzlich
    // durchgereicht; geprüft wird hier das Auffüllen der optionalen Defaults.
    expect(mockedWorkshopsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        managerId: "u1",
        name: "Werkstatt",
        description: "desc",
        location: "Muenchen",
        maxCapacity: 4,
        extras: [],
        workshopTools: [],
        imageUrls: []
      })
    );
  });

  it("updates workshop for owner", async () => {
    mockedWorkshopsRepository.findById.mockResolvedValueOnce({ id: "w1", managerId: "owner-1" } as any);
    mockedWorkshopsRepository.update.mockResolvedValueOnce({ id: "w1", name: "Neu" } as any);

    const result = await workshopsService.update({
      workshopId: "w1",
      managerId: "owner-1",
      actorRole: "USER",
      data: { name: "Neu" }
    });

    expect(mockedWorkshopsRepository.update).toHaveBeenCalledWith("w1", { name: "Neu" });
    expect(result).toMatchObject({ id: "w1", name: "Neu" });
  });

  it("blocks workshop updates for non-owners without manager role", async () => {
    mockedWorkshopsRepository.findById.mockResolvedValueOnce({ id: "w1", managerId: "owner-1" } as any);

    await expect(
      workshopsService.update({
        workshopId: "w1",
        managerId: "other-user",
        actorRole: "USER",
        data: { name: "Neu" }
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("removes workshop as manager role", async () => {
    mockedWorkshopsRepository.findById.mockResolvedValueOnce({ id: "w1", managerId: "owner-1" } as any);

    await workshopsService.remove({
      workshopId: "w1",
      managerId: "other-manager",
      actorRole: "MANAGER"
    });

    expect(mockedWorkshopsRepository.remove).toHaveBeenCalledWith("w1");
  });

  it("creates timeslot when input is valid", async () => {
    mockedWorkshopsRepository.findById.mockResolvedValueOnce({ id: "w1", managerId: "owner-1" } as any);
    mockedWorkshopsRepository.findOverlappingTimeslot.mockResolvedValueOnce(null);
    mockedWorkshopsRepository.createTimeslot.mockResolvedValueOnce({ id: "slot-1" } as any);

    const result = await workshopsService.createTimeslot({
      workshopId: "w1",
      managerId: "owner-1",
      actorRole: "USER",
      startTime: "2026-06-01T10:00:00.000Z",
      endTime: "2026-06-01T12:00:00.000Z"
    });

    expect(mockedWorkshopsRepository.createTimeslot).toHaveBeenCalled();
    expect(result).toMatchObject({ id: "slot-1" });
  });

  it("creates blocked timeslot by splitting overlapping availability", async () => {
    mockedWorkshopsRepository.findById.mockResolvedValueOnce({ id: "w1", managerId: "owner-1" } as any);
    mockedWorkshopsRepository.createBlockedTimeslotWithAvailabilitySplit.mockResolvedValueOnce({
      id: "slot-blocked",
      blockedByOwner: true
    } as any);

    const result = await workshopsService.createTimeslot({
      workshopId: "w1",
      managerId: "owner-1",
      actorRole: "USER",
      startTime: "2026-02-01T08:00:00.000Z",
      endTime: "2026-02-28T18:00:00.000Z",
      blockedByOwner: true
    });

    expect(mockedWorkshopsRepository.createBlockedTimeslotWithAvailabilitySplit).toHaveBeenCalledWith({
      workshopId: "w1",
      startTime: new Date("2026-02-01T08:00:00.000Z"),
      endTime: new Date("2026-02-28T18:00:00.000Z")
    });
    expect(mockedWorkshopsRepository.createTimeslot).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: "slot-blocked", blockedByOwner: true });
  });

  it("maps blocked overlap conflicts to TIMESLOT_CONFLICT", async () => {
    mockedWorkshopsRepository.findById.mockResolvedValueOnce({ id: "w1", managerId: "owner-1" } as any);
    mockedWorkshopsRepository.createBlockedTimeslotWithAvailabilitySplit.mockResolvedValueOnce(
      "BLOCKED_CONFLICT" as any
    );

    await expect(
      workshopsService.createTimeslot({
        workshopId: "w1",
        managerId: "owner-1",
        actorRole: "USER",
        startTime: "2026-02-01T08:00:00.000Z",
        endTime: "2026-02-28T18:00:00.000Z",
        blockedByOwner: true
      })
    ).rejects.toMatchObject({ code: "TIMESLOT_CONFLICT", status: 409 });
  });

  it("maps active booking conflicts while inserting blocked timeslots", async () => {
    mockedWorkshopsRepository.findById.mockResolvedValueOnce({ id: "w1", managerId: "owner-1" } as any);
    mockedWorkshopsRepository.createBlockedTimeslotWithAvailabilitySplit.mockResolvedValueOnce(
      "ACTIVE_BOOKING_EXISTS" as any
    );

    await expect(
      workshopsService.createTimeslot({
        workshopId: "w1",
        managerId: "owner-1",
        actorRole: "USER",
        startTime: "2026-02-01T08:00:00.000Z",
        endTime: "2026-02-28T18:00:00.000Z",
        blockedByOwner: true
      })
    ).rejects.toMatchObject({ code: "ACTIVE_BOOKING_EXISTS", status: 409 });
  });

  it("rejects invalid timeslot ranges", async () => {
    mockedWorkshopsRepository.findById.mockResolvedValueOnce({ id: "w1", managerId: "owner-1" } as any);

    await expect(
      workshopsService.createTimeslot({
        workshopId: "w1",
        managerId: "owner-1",
        actorRole: "USER",
        startTime: "2026-06-01T12:00:00.000Z",
        endTime: "2026-06-01T10:00:00.000Z"
      })
    ).rejects.toMatchObject({ code: "INVALID_TIME_RANGE", status: 400 });
  });

  it("rejects overlapping timeslots", async () => {
    mockedWorkshopsRepository.findById.mockResolvedValueOnce({ id: "w1", managerId: "owner-1" } as any);
    mockedWorkshopsRepository.findOverlappingTimeslot.mockResolvedValueOnce({ id: "slot-existing" } as any);

    await expect(
      workshopsService.createTimeslot({
        workshopId: "w1",
        managerId: "owner-1",
        actorRole: "USER",
        startTime: "2026-06-01T10:00:00.000Z",
        endTime: "2026-06-01T12:00:00.000Z"
      })
    ).rejects.toMatchObject({ code: "TIMESLOT_CONFLICT", status: 409 });
  });

  it("rejects time-range updates when active bookings exist", async () => {
    mockedWorkshopsRepository.findTimeslotById.mockResolvedValueOnce({
      id: "slot-1",
      workshopId: "w1",
      startTime: new Date("2026-05-10T08:00:00.000Z"),
      endTime: new Date("2026-05-10T18:00:00.000Z"),
      blockedByOwner: false,
      workshop: { managerId: "owner-1" }
    } as any);
    mockedWorkshopsRepository.findActiveBookingForTimeslot.mockResolvedValueOnce({ id: "b1" } as any);

    await expect(
      workshopsService.updateTimeslot({
        workshopId: "w1",
        timeslotId: "slot-1",
        managerId: "owner-1",
        actorRole: "USER",
        startTime: "2026-05-10T09:00:00.000Z"
      })
    ).rejects.toMatchObject({ code: "ACTIVE_BOOKING_EXISTS", status: 409 });

    expect(mockedWorkshopsRepository.updateTimeslot).not.toHaveBeenCalled();
  });

  it("updates slots to blocked without overlap checks", async () => {
    mockedWorkshopsRepository.findTimeslotById.mockResolvedValueOnce({
      id: "slot-1",
      workshopId: "w1",
      startTime: new Date("2026-05-10T08:00:00.000Z"),
      endTime: new Date("2026-05-10T18:00:00.000Z"),
      blockedByOwner: false,
      workshop: { managerId: "owner-1" }
    } as any);
    mockedWorkshopsRepository.updateTimeslot.mockResolvedValueOnce({
      id: "slot-1",
      blockedByOwner: true
    } as any);

    const result = await workshopsService.updateTimeslot({
      workshopId: "w1",
      timeslotId: "slot-1",
      managerId: "owner-1",
      actorRole: "USER",
      blockedByOwner: true
    });

    expect(mockedWorkshopsRepository.findOverlappingTimeslot).not.toHaveBeenCalled();
    expect(mockedWorkshopsRepository.updateTimeslot).toHaveBeenCalledWith("slot-1", {
      startTime: undefined,
      endTime: undefined,
      blockedByOwner: true
    });
    expect(result).toMatchObject({ id: "slot-1", blockedByOwner: true });
  });

  it("rejects blocking an available slot with an active booking", async () => {
    mockedWorkshopsRepository.findTimeslotById.mockResolvedValueOnce({
      id: "slot-1",
      workshopId: "w1",
      startTime: new Date("2026-05-10T08:00:00.000Z"),
      endTime: new Date("2026-05-10T18:00:00.000Z"),
      blockedByOwner: false,
      workshop: { managerId: "owner-1" }
    } as any);
    mockedWorkshopsRepository.findActiveBookingForTimeslot.mockResolvedValueOnce({
      id: "accepted-booking",
      status: "ACCEPTED"
    } as any);

    await expect(
      workshopsService.updateTimeslot({
        workshopId: "w1",
        timeslotId: "slot-1",
        managerId: "owner-1",
        actorRole: "USER",
        blockedByOwner: true
      })
    ).rejects.toMatchObject({
      code: "ACTIVE_BOOKING_EXISTS",
      status: 409
    });

    expect(mockedWorkshopsRepository.updateTimeslot).not.toHaveBeenCalled();
  });

  it("rejects overlap when updated slot stays available", async () => {
    mockedWorkshopsRepository.findTimeslotById.mockResolvedValueOnce({
      id: "slot-1",
      workshopId: "w1",
      startTime: new Date("2026-05-10T08:00:00.000Z"),
      endTime: new Date("2026-05-10T18:00:00.000Z"),
      blockedByOwner: false,
      workshop: { managerId: "owner-1" }
    } as any);
    mockedWorkshopsRepository.findActiveBookingForTimeslot.mockResolvedValueOnce(null);
    mockedWorkshopsRepository.findOverlappingTimeslot.mockResolvedValueOnce({ id: "slot-existing" } as any);

    await expect(
      workshopsService.updateTimeslot({
        workshopId: "w1",
        timeslotId: "slot-1",
        managerId: "owner-1",
        actorRole: "USER",
        startTime: "2026-05-10T09:00:00.000Z",
        endTime: "2026-05-10T19:00:00.000Z",
        blockedByOwner: false
      })
    ).rejects.toMatchObject({ code: "TIMESLOT_CONFLICT", status: 409 });
  });

  it("removes timeslot when no active booking exists", async () => {
    mockedWorkshopsRepository.findTimeslotById.mockResolvedValueOnce({
      id: "slot-1",
      workshopId: "w1",
      workshop: { managerId: "owner-1" }
    } as any);
    mockedWorkshopsRepository.findActiveBookingForTimeslot.mockResolvedValueOnce(null);

    await workshopsService.removeTimeslot({
      workshopId: "w1",
      timeslotId: "slot-1",
      managerId: "owner-1",
      actorRole: "USER"
    });

    expect(mockedWorkshopsRepository.removeTimeslot).toHaveBeenCalledWith("slot-1");
  });

  it("rejects removing timeslot with active booking", async () => {
    mockedWorkshopsRepository.findTimeslotById.mockResolvedValueOnce({
      id: "slot-1",
      workshopId: "w1",
      workshop: { managerId: "owner-1" }
    } as any);
    mockedWorkshopsRepository.findActiveBookingForTimeslot.mockResolvedValueOnce({ id: "b1" } as any);

    await expect(
      workshopsService.removeTimeslot({
        workshopId: "w1",
        timeslotId: "slot-1",
        managerId: "owner-1",
        actorRole: "USER"
      })
    ).rejects.toMatchObject({ code: "ACTIVE_BOOKING_EXISTS", status: 409 });
  });
});
