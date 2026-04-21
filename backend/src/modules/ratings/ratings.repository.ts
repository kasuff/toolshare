import { prisma } from "../../config/prisma";

export const ratingsRepository = {
  findBookingWithParticipants(bookingId: string) {
    return prisma.booking.findUnique({
      where: { id: bookingId },
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

  create(input: { bookingId: string; fromUserId: string; toUserId: string; score: number; comment?: string }) {
    return prisma.rating.create({
      data: {
        bookingId: input.bookingId,
        fromUserId: input.fromUserId,
        toUserId: input.toUserId,
        score: input.score,
        comment: input.comment
      }
    });
  },

  listReceived(userId: string) {
    return prisma.rating.findMany({
      where: { toUserId: userId },
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
  },

  listGiven(userId: string) {
    return prisma.rating.findMany({
      where: { fromUserId: userId },
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
  }
};