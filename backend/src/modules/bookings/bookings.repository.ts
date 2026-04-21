import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";

export const bookingsRepository = {
  findToolById(toolId: string) {
    return prisma.tool.findUnique({ where: { id: toolId } });
  },

  findBookingById(id: string) {
    return prisma.booking.findUnique({
      where: { id },
      include: { tool: true }
    });
  },

  findOverlappingToolBooking(toolId: string, startDate: Date, endDate: Date) {
    return prisma.booking.findFirst({
      where: {
        toolId,
        status: { in: ["PENDING", "ACCEPTED"] },
        startDate: { lt: endDate },
        endDate: { gt: startDate }
      }
    });
  },

  createToolBooking(input: {
    userId: string;
    toolId: string;
    startDate: Date;
    endDate: Date;
    pickupTime: Date;
  }) {
    return prisma.booking.create({
      data: {
        userId: input.userId,
        toolId: input.toolId,
        startDate: input.startDate,
        endDate: input.endDate,
        pickupTime: input.pickupTime,
        status: "PENDING"
      }
    });
  },

  createWorkshopBookingTransaction(input: { userId: string; timeslotId: string }) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const slot = await tx.timeSlot.findUnique({
        where: { id: input.timeslotId }
      });

      if (!slot) {
        return null;
      }

      const existing = await tx.booking.findFirst({
        where: {
          timeslotId: input.timeslotId,
          status: { in: ["PENDING", "ACCEPTED"] }
        }
      });

      if (existing) {
        return "CONFLICT" as const;
      }

      const booking = await tx.booking.create({
        data: {
          userId: input.userId,
          timeslotId: input.timeslotId,
          startDate: slot.startTime,
          endDate: slot.endTime,
          status: "PENDING"
        }
      });

      return booking;
    });
  },

  updateStatus(id: string, status: "PENDING" | "ACCEPTED" | "REJECTED" | "RETURNED") {
    return prisma.booking.update({
      where: { id },
      data: { status }
    });
  }
};
