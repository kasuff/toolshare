import { beforeEach, describe, expect, it, vi } from "vitest";
import { ratingsRepository } from "../src/modules/ratings/ratings.repository";

const mocks = vi.hoisted(() => ({
  bookingFindUnique: vi.fn(),
  ratingFindUnique: vi.fn(),
  ratingFindFirst: vi.fn(),
  ratingCreate: vi.fn(),
  ratingFindMany: vi.fn(),
  ratingUpdate: vi.fn()
}));

vi.mock("../src/config/prisma", () => ({
  prisma: {
    booking: {
      findUnique: mocks.bookingFindUnique
    },
    rating: {
      findUnique: mocks.ratingFindUnique,
      findFirst: mocks.ratingFindFirst,
      create: mocks.ratingCreate,
      findMany: mocks.ratingFindMany,
      update: mocks.ratingUpdate
    }
  }
}));

const ratingInclude = {
  fromUser: {
    select: {
      id: true,
      name: true,
      role: true
    }
  },
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
      endDate: true,
      toolId: true,
      tool: {
        select: {
          id: true,
          name: true
        }
      },
      timeslot: {
        select: {
          workshopId: true,
          workshop: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    }
  }
};

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
            id: true,
            ownerId: true,
            name: true
          }
        },
        timeslot: {
          include: {
            workshop: {
              select: {
                id: true,
                managerId: true,
                name: true
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
      },
      include: ratingInclude
    });
    expect(result).toEqual({ id: "rating-2", score: 5 });
  });

  it("lists visible received ratings", async () => {
    mocks.ratingFindMany.mockResolvedValueOnce([{ id: "r-received" }]);

    const result = await ratingsRepository.listReceived("user-1");

    expect(mocks.ratingFindMany).toHaveBeenCalledWith({
      where: { toUserId: "user-1", status: "VISIBLE" },
      include: ratingInclude,
      orderBy: { createdAt: "desc" }
    });
    expect(result).toEqual([{ id: "r-received" }]);
  });

  it("lists ratings for a tool", async () => {
    mocks.ratingFindMany.mockResolvedValueOnce([{ id: "r-tool" }]);

    const result = await ratingsRepository.listForTool("tool-1");

    expect(mocks.ratingFindMany).toHaveBeenCalledWith({
      where: {
        status: "VISIBLE",
        booking: { toolId: "tool-1" }
      },
      include: ratingInclude,
      orderBy: { createdAt: "desc" }
    });
    expect(result).toEqual([{ id: "r-tool" }]);
  });

  it("lists ratings for a workshop", async () => {
    mocks.ratingFindMany.mockResolvedValueOnce([{ id: "r-workshop" }]);

    const result = await ratingsRepository.listForWorkshop("workshop-1");

    expect(mocks.ratingFindMany).toHaveBeenCalledWith({
      where: {
        status: "VISIBLE",
        booking: {
          timeslot: {
            workshopId: "workshop-1"
          }
        }
      },
      include: ratingInclude,
      orderBy: { createdAt: "desc" }
    });
    expect(result).toEqual([{ id: "r-workshop" }]);
  });
});
