import { prisma } from "../../config/prisma";

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
} as const;

export const ratingsRepository = {
  findBookingWithParticipants(bookingId: string) {
    return prisma.booking.findUnique({
      where: { id: bookingId },
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
  },

  findById(ratingId: string) {
    return prisma.rating.findUnique({
      where: { id: ratingId },
      include: ratingInclude
    });
  },

  findExisting(bookingId: string, fromUserId: string, toUserId: string) {
    return prisma.rating.findUnique({
      where: {
        bookingId_fromUserId_toUserId: {
          bookingId,
          fromUserId,
          toUserId
        }
      }
    });
  },

  findByBookingAndRequester(bookingId: string, fromUserId: string) {
    return prisma.rating.findFirst({
      where: {
        bookingId,
        fromUserId
      }
    });
  },

  create(input: { bookingId: string; fromUserId: string; toUserId: string; score: number; comment?: string }) {
    return prisma.rating.create({
      data: {
        bookingId: input.bookingId,
        fromUserId: input.fromUserId,
        toUserId: input.toUserId,
        score: input.score,
        comment: input.comment
      },
      include: ratingInclude
    });
  },

  hide(ratingId: string, moderatorId: string, decisionNote?: string) {
    return prisma.rating.update({
      where: { id: ratingId },
      data: {
        status: "HIDDEN",
        moderatorId,
        decisionNote: decisionNote?.trim() || null,
        moderatedAt: new Date()
      },
      include: ratingInclude
    });
  },

  remove(ratingId: string) {
    return prisma.rating.delete({
      where: { id: ratingId }
    });
  },

  listReceived(userId: string, includeHidden = false) {
    return prisma.rating.findMany({
      where: {
        toUserId: userId,
        ...(includeHidden ? {} : { status: "VISIBLE" })
      },
      include: ratingInclude,
      orderBy: { createdAt: "desc" }
    });
  },

  listGiven(userId: string) {
    return prisma.rating.findMany({
      where: { fromUserId: userId },
      include: ratingInclude,
      orderBy: { createdAt: "desc" }
    });
  },

  listForTool(toolId: string) {
    return prisma.rating.findMany({
      where: {
        status: "VISIBLE",
        booking: {
          toolId
        }
      },
      include: ratingInclude,
      orderBy: { createdAt: "desc" }
    });
  },

  listForWorkshop(workshopId: string) {
    return prisma.rating.findMany({
      where: {
        status: "VISIBLE",
        booking: {
          timeslot: {
            workshopId
          }
        }
      },
      include: ratingInclude,
      orderBy: { createdAt: "desc" }
    });
  }
};
