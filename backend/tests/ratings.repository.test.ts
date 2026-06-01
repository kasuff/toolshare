import { beforeEach, describe, expect, it, vi } from "vitest";
import { ratingsRepository } from "../src/modules/ratings/ratings.repository";

const mocks = vi.hoisted(() => ({
  bookingFindUnique: vi.fn(),
  ratingFindUnique: vi.fn(),
  ratingCreate: vi.fn(),
  ratingFindMany: vi.fn()
}));

vi.mock("../src/config/prisma", () => ({
  prisma: {
    booking: {
      findUnique: mocks.bookingFindUnique
    },
    rating: {
      findUnique: mocks.ratingFindUnique,
      create: mocks.ratingCreate,
      findMany: mocks.ratingFindMany
    }
  }
}));

describe("ratingsRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads booking with rating participants", async () => {
    mocks.bookingFindUnique.mockResolvedValueOnce({ id: "booking-1" });

    const result = await ratingsRepository.findBookingWithParticipants("booking-1");

    expect(mocks.bookingFindUnique).toHaveBeenCalledWith({
      where: { id: "booking-1" },
      include: {
        tool: {
          select: {
            ownerId: true
          }
        },
        timeslot: {
          include: {
            workshop: {
              select: {
                managerId: true
              }
            }
          }
        }
      }
    });
    expect(result).toEqual({ id: "booking-1" });
  });

  it("finds existing rating for booking pair", async () => {
    mocks.ratingFindUnique.mockResolvedValueOnce({ id: "rating-1" });

    const result = await ratingsRepository.findExisting("booking-1", "from-1", "to-1");

    expect(mocks.ratingFindUnique).toHaveBeenCalledWith({
      where: {
        bookingId_fromUserId_toUserId: {
          bookingId: "booking-1",
          fromUserId: "from-1",
          toUserId: "to-1"
        }
      }
    });
    expect(result).toEqual({ id: "rating-1" });
  });

  it("creates rating entries", async () => {
    mocks.ratingCreate.mockResolvedValueOnce({ id: "rating-2", score: 5 });

    const result = await ratingsRepository.create({
      bookingId: "booking-1",
      fromUserId: "from-1",
      toUserId: "to-1",
      score: 5,
      comment: "Top"
    });

    expect(mocks.ratingCreate).toHaveBeenCalledWith({
      data: {
        bookingId: "booking-1",
        fromUserId: "from-1",
        toUserId: "to-1",
        score: 5,
        comment: "Top"
      }
    });
    expect(result).toEqual({ id: "rating-2", score: 5 });
  });

  it("lists received ratings with user + booking context", async () => {
    mocks.ratingFindMany.mockResolvedValueOnce([{ id: "r-received" }]);

    const result = await ratingsRepository.listReceived("user-1");

    expect(mocks.ratingFindMany).toHaveBeenCalledWith({
      where: { toUserId: "user-1" },
      include: {
        fromUser: {
          select: {
            id: true,
            name: true,
            role: true
          }
        },
        booking: {
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    expect(result).toEqual([{ id: "r-received" }]);
  });

  it("lists given ratings with user + booking context", async () => {
    mocks.ratingFindMany.mockResolvedValueOnce([{ id: "r-given" }]);

    const result = await ratingsRepository.listGiven("user-1");

    expect(mocks.ratingFindMany).toHaveBeenCalledWith({
      where: { fromUserId: "user-1" },
      include: {
        toUser: {
          select: {
            id: true,
            name: true,
            role: true
          }
        },
        booking: {
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    expect(result).toEqual([{ id: "r-given" }]);
  });
});
