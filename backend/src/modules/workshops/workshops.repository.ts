import { prisma } from "../../config/prisma";

export const workshopsRepository = {
  list(filters: { managerId?: string; location?: string; search?: string }) {
    return prisma.workshop.findMany({
      where: {
        managerId: filters.managerId,
        location: filters.location
          ? { contains: filters.location, mode: "insensitive" }
          : undefined,
        OR: filters.search
          ? [
              { name: { contains: filters.search, mode: "insensitive" } },
              { description: { contains: filters.search, mode: "insensitive" } },
              { location: { contains: filters.search, mode: "insensitive" } }
            ]
          : undefined
      },
      include: {
        manager: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { name: "asc" }
    });
  },

  findById(id: string) {
    return prisma.workshop.findUnique({
      where: { id },
      include: {
        manager: {
          select: {
            id: true,
            name: true
          }
        },
        timeslots: {
          orderBy: { startTime: "asc" }
        }
      }
    });
  },

  create(input: {
    managerId: string;
    name: string;
    description: string;
    location: string;
    maxCapacity: number;
  }) {
    return prisma.workshop.create({
      data: input
    });
  },

  update(
    id: string,
    data: {
      name?: string;
      description?: string;
      location?: string;
      maxCapacity?: number;
    }
  ) {
    return prisma.workshop.update({
      where: { id },
      data
    });
  },

  remove(id: string) {
    return prisma.workshop.delete({ where: { id } });
  },

  findOverlappingTimeslot(workshopId: string, startTime: Date, endTime: Date) {
    return prisma.timeSlot.findFirst({
      where: {
        workshopId,
        startTime: { lt: endTime },
        endTime: { gt: startTime }
      }
    });
  },

  createTimeslot(input: { workshopId: string; startTime: Date; endTime: Date }) {
    return prisma.timeSlot.create({
      data: {
        workshopId: input.workshopId,
        startTime: input.startTime,
        endTime: input.endTime
      }
    });
  },

  findTimeslotById(id: string) {
    return prisma.timeSlot.findUnique({
      where: { id },
      include: {
        workshop: true
      }
    });
  },

  findActiveBookingForTimeslot(timeslotId: string) {
    return prisma.booking.findFirst({
      where: {
        timeslotId,
        status: { in: ["PENDING", "ACCEPTED"] }
      }
    });
  },

  removeTimeslot(id: string) {
    return prisma.timeSlot.delete({ where: { id } });
  }
};