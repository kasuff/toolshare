import { beforeEach, describe, expect, it, vi } from "vitest";
import { ratingsRepository } from "../src/modules/ratings/ratings.repository";
import { notificationsRepository } from "../src/modules/notifications/notifications.repository";
import { ratingsService } from "../src/modules/ratings/ratings.service";

vi.mock("../src/modules/ratings/ratings.repository", () => ({
  ratingsRepository: {
    listReceived: vi.fn(),
    listGiven: vi.fn(),
    findBookingWithParticipants: vi.fn(),
    findExisting: vi.fn(),
    create: vi.fn()
  }
}));

vi.mock("../src/modules/notifications/notifications.repository", () => ({
  notificationsRepository: {
    create: vi.fn()
  }
}));

const mockedRatingsRepository = vi.mocked(ratingsRepository);
const mockedNotificationsRepository = vi.mocked(notificationsRepository);

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

  it("rejects self ratings", async () => {
    await expect(
      ratingsService.create({
        bookingId: "b1",
        fromUserId: "u1",
        toUserId: "u1",
        score: 5
      })
    ).rejects.toMatchObject({ code: "INVALID_RATING_TARGET", status: 400 });
  });

  it("rejects missing bookings", async () => {
    mockedRatingsRepository.findBookingWithParticipants.mockResolvedValueOnce(null);

    await expect(
      ratingsService.create({
        bookingId: "missing",
        fromUserId: "u1",
        toUserId: "u2",
        score: 4
      })
    ).rejects.toMatchObject({ code: "BOOKING_NOT_FOUND", status: 404 });
  });

  it("rejects ratings from non-participants", async () => {
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
        fromUserId: "someone-else",
        toUserId: "owner",
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
        toUserId: "owner",
        score: 4
      })
    ).rejects.toMatchObject({ code: "RATING_NOT_ALLOWED", status: 409 });
  });

  it("rejects duplicate ratings for same booking pair", async () => {
    mockedRatingsRepository.findBookingWithParticipants.mockResolvedValueOnce({
      id: "b1",
      userId: "requester",
      tool: { ownerId: "owner" },
      timeslot: null,
      status: "RETURNED",
      endDate: new Date("2026-01-01T00:00:00.000Z")
    } as any);
    mockedRatingsRepository.findExisting.mockResolvedValueOnce({ id: "existing-rating" } as any);

    await expect(
      ratingsService.create({
        bookingId: "b1",
        fromUserId: "requester",
        toUserId: "owner",
        score: 5
      })
    ).rejects.toMatchObject({ code: "RATING_ALREADY_EXISTS", status: 409 });
  });

  it("creates rating and notifies receiver", async () => {
    mockedRatingsRepository.findBookingWithParticipants.mockResolvedValueOnce({
      id: "b1",
      userId: "requester",
      tool: { ownerId: "owner" },
      timeslot: { workshop: { managerId: "manager" } },
      status: "RETURNED",
      endDate: new Date("2026-01-01T00:00:00.000Z")
    } as any);
    mockedRatingsRepository.findExisting.mockResolvedValueOnce(null);
    mockedRatingsRepository.create.mockResolvedValueOnce({ id: "rating-1", score: 5 } as any);

    const result = await ratingsService.create({
      bookingId: "b1",
      fromUserId: "requester",
      toUserId: "owner",
      score: 5,
      comment: "Top"
    });

    expect(mockedRatingsRepository.create).toHaveBeenCalledWith({
      bookingId: "b1",
      fromUserId: "requester",
      toUserId: "owner",
      score: 5,
      comment: "Top"
    });
    expect(mockedNotificationsRepository.create).toHaveBeenCalledWith("owner", expect.stringContaining("Bewertung"));
    expect(result).toMatchObject({ id: "rating-1", score: 5 });
  });
});
