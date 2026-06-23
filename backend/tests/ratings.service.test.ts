import { beforeEach, describe, expect, it, vi } from "vitest";
import { ratingsRepository } from "../src/modules/ratings/ratings.repository";
import { ratingsService } from "../src/modules/ratings/ratings.service";

vi.mock("../src/modules/ratings/ratings.repository", () => ({
  ratingsRepository: {
    listReceived: vi.fn(),
    listGiven: vi.fn(),
    findBookingWithParticipants: vi.fn(),
    findByBookingAndRequester: vi.fn(),
    create: vi.fn(),
    createWithNotification: vi.fn(),
    listForTool: vi.fn(),
    listForWorkshop: vi.fn(),
    hide: vi.fn(),
    findById: vi.fn(),
    remove: vi.fn()
  }
}));

vi.mock("../src/infrastructure/outbox/enqueue-user-notification", () => ({
  enqueueModerationNotification: vi.fn(),
  newModerationNotificationKey: vi.fn(() => "moderation:key")
}));

const mockedRatingsRepository = vi.mocked(ratingsRepository);

describe("ratingsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists received ratings", async () => {
    mockedRatingsRepository.listReceived.mockResolvedValueOnce([{ id: "r1" }] as any);

    const result = await ratingsService.listReceived("u1");

    expect(result).toEqual([{ id: "r1" }]);
  });

  it("lists given ratings", async () => {
    mockedRatingsRepository.listGiven.mockResolvedValueOnce([{ id: "r2" }] as any);

    const result = await ratingsService.listGiven("u1");

    expect(result).toEqual([{ id: "r2" }]);
  });

  it("rejects missing bookings", async () => {
    mockedRatingsRepository.findBookingWithParticipants.mockResolvedValueOnce(null);

    await expect(
      ratingsService.create({
        bookingId: "missing",
        fromUserId: "requester",
        score: 4
      })
    ).rejects.toMatchObject({ code: "BOOKING_NOT_FOUND", status: 404 });
  });

  it("rejects ratings from non-requesters", async () => {
    mockedRatingsRepository.findBookingWithParticipants.mockResolvedValueOnce({
      id: "b1",
      userId: "requester",
      tool: { ownerId: "owner" },
      timeslot: null,
      status: "RETURNED",
      endDate: new Date("2026-01-01T00:00:00.000Z")
    } as any);

    await expect(
      ratingsService.create({
        bookingId: "b1",
        fromUserId: "owner",
        score: 4
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects ratings for unfinished bookings", async () => {
    mockedRatingsRepository.findBookingWithParticipants.mockResolvedValueOnce({
      id: "b1",
      userId: "requester",
      tool: { ownerId: "owner" },
      timeslot: null,
      status: "ACCEPTED",
      endDate: new Date("2099-01-01T00:00:00.000Z")
    } as any);

    await expect(
      ratingsService.create({
        bookingId: "b1",
        fromUserId: "requester",
        score: 4
      })
    ).rejects.toMatchObject({ code: "RATING_NOT_ALLOWED", status: 409 });
  });

  it("rejects duplicate ratings for the same booking", async () => {
    mockedRatingsRepository.findBookingWithParticipants.mockResolvedValueOnce({
      id: "b1",
      userId: "requester",
      tool: { ownerId: "owner" },
      timeslot: null,
      status: "RETURNED",
      endDate: new Date("2026-01-01T00:00:00.000Z")
    } as any);
    mockedRatingsRepository.findByBookingAndRequester.mockResolvedValueOnce({ id: "existing-rating" } as any);

    await expect(
      ratingsService.create({
        bookingId: "b1",
        fromUserId: "requester",
        score: 5
      })
    ).rejects.toMatchObject({ code: "RATING_ALREADY_EXISTS", status: 409 });
  });

  it("creates rating for provider and notifies receiver", async () => {
    mockedRatingsRepository.findBookingWithParticipants.mockResolvedValueOnce({
      id: "b1",
      userId: "requester",
      tool: { ownerId: "owner" },
      timeslot: { workshop: { managerId: "manager" } },
      status: "RETURNED",
      endDate: new Date("2026-01-01T00:00:00.000Z")
    } as any);
    mockedRatingsRepository.findByBookingAndRequester.mockResolvedValueOnce(null);
    mockedRatingsRepository.createWithNotification.mockResolvedValueOnce({ id: "rating-1", score: 5 } as any);

    const result = await ratingsService.create({
      bookingId: "b1",
      fromUserId: "requester",
      score: 5,
      comment: "Top"
    });

    expect(mockedRatingsRepository.createWithNotification).toHaveBeenCalledWith({
      bookingId: "b1",
      fromUserId: "requester",
      toUserId: "owner",
      score: 5,
      comment: "Top",
      starsLabel: "5 Sterne"
    });
    expect(result).toMatchObject({ id: "rating-1", score: 5 });
  });

  it("allows rating after booking period ended even if not returned", async () => {
    mockedRatingsRepository.findBookingWithParticipants.mockResolvedValueOnce({
      id: "b1",
      userId: "requester",
      tool: { ownerId: "owner" },
      timeslot: null,
      status: "ACCEPTED",
      endDate: new Date("2020-01-01T00:00:00.000Z")
    } as any);
    mockedRatingsRepository.findByBookingAndRequester.mockResolvedValueOnce(null);
    mockedRatingsRepository.createWithNotification.mockResolvedValueOnce({ id: "rating-2", score: 4 } as any);

    await ratingsService.create({
      bookingId: "b1",
      fromUserId: "requester",
      score: 4
    });

    expect(mockedRatingsRepository.createWithNotification).toHaveBeenCalled();
  });

  it("hides a rating from moderation", async () => {
    mockedRatingsRepository.findById.mockResolvedValueOnce({ id: "rating-1", status: "VISIBLE" } as any);
    mockedRatingsRepository.hide.mockResolvedValueOnce({ id: "rating-1", status: "HIDDEN" } as any);

    const result = await ratingsService.hideFromModeration("rating-1", "mod-1", "Unangemessen");

    expect(mockedRatingsRepository.hide).toHaveBeenCalledWith("rating-1", "mod-1", "Unangemessen");
    expect(result).toMatchObject({ id: "rating-1", status: "HIDDEN" });
  });

  it("skips hide when rating is already hidden", async () => {
    mockedRatingsRepository.findById.mockResolvedValueOnce({ id: "rating-1", status: "HIDDEN" } as any);

    const result = await ratingsService.hideFromModeration("rating-1", "mod-1");

    expect(mockedRatingsRepository.hide).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: "rating-1", status: "HIDDEN" });
  });

  it("lists ratings for tools and workshops", async () => {
    mockedRatingsRepository.listForTool.mockResolvedValueOnce([{ id: "r-tool" }] as any);
    mockedRatingsRepository.listForWorkshop.mockResolvedValueOnce([{ id: "r-workshop" }] as any);

    await expect(ratingsService.listForTool("tool-1")).resolves.toEqual([{ id: "r-tool" }]);
    await expect(ratingsService.listForWorkshop("workshop-1")).resolves.toEqual([{ id: "r-workshop" }]);
  });

  it("rejects hide when rating is missing", async () => {
    mockedRatingsRepository.findById.mockResolvedValueOnce(null);

    await expect(ratingsService.hideFromModeration("missing", "mod-1")).rejects.toMatchObject({
      code: "RATING_NOT_FOUND",
      status: 404
    });
  });

  it("removes rating from moderation", async () => {
    mockedRatingsRepository.findById.mockResolvedValueOnce({ id: "rating-1", status: "VISIBLE" } as any);
    mockedRatingsRepository.remove.mockResolvedValueOnce({ id: "rating-1" } as any);

    const result = await ratingsService.removeFromModeration("rating-1");

    expect(mockedRatingsRepository.remove).toHaveBeenCalledWith("rating-1");
    expect(result).toMatchObject({ id: "rating-1" });
  });

  it("rejects remove when rating is missing", async () => {
    mockedRatingsRepository.findById.mockResolvedValueOnce(null);

    await expect(ratingsService.removeFromModeration("missing")).rejects.toMatchObject({
      code: "RATING_NOT_FOUND",
      status: 404
    });
  });

  it("uses workshop manager as provider when booking has no tool", async () => {
    mockedRatingsRepository.findBookingWithParticipants.mockResolvedValueOnce({
      id: "b1",
      userId: "requester",
      tool: null,
      timeslot: { workshop: { managerId: "manager-1" } },
      status: "RETURNED",
      endDate: new Date("2026-01-01T00:00:00.000Z")
    } as any);
    mockedRatingsRepository.findByBookingAndRequester.mockResolvedValueOnce(null);
    mockedRatingsRepository.createWithNotification.mockResolvedValueOnce({ id: "rating-3", score: 5 } as any);

    await ratingsService.create({
      bookingId: "b1",
      fromUserId: "requester",
      score: 5
    });

    expect(mockedRatingsRepository.createWithNotification).toHaveBeenCalledWith(
      expect.objectContaining({ toUserId: "manager-1" })
    );
  });
});
