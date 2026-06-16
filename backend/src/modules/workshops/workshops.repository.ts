import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";

export const workshopsRepository = {
  list(filters: {
    managerId?: string;
    location?: string;
    search?: string;
    excludeSuspendedManagers?: boolean;
  }) {
    return prisma.workshop.findMany({
      where: {
        managerId: filters.managerId,
        manager: filters.excludeSuspendedManagers ? { isSuspended: false } : undefined,
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
            name: true,
            isSuspended: true
          }
        },
        workshopTools: {
          select: {
            id: true,
            name: true,
            category: true
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
            name: true,
            isSuspended: true
          }
        },
        workshopTools: {
          select: {
            id: true,
            name: true,
            category: true
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
    extras: string[];
    workshopTools: Array<{ name: string; category: string }>;
    imageUrls: string[];
  }) {
    return prisma.workshop.create({
      data: {
        managerId: input.managerId,
        name: input.name,
        description: input.description,
        location: input.location,
        maxCapacity: input.maxCapacity,
        equipment: input.extras,
        imageUrls: input.imageUrls,
        workshopTools: {
          create: input.workshopTools.map((tool) => ({
            name: tool.name,
            category: tool.category
          }))
        }
      },
      include: {
        workshopTools: {
          select: {
            id: true,
            name: true,
            category: true
          }
        }
      }
    });
  },

  update(
    id: string,
    data: {
      name?: string;
      description?: string;
      location?: string;
      maxCapacity?: number;
      extras?: string[];
      workshopTools?: Array<{ name: string; category: string }>;
      imageUrls?: string[];
    }
  ) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const { workshopTools, extras, ...rest } = data;

      if (workshopTools !== undefined) {
        await tx.workshopTool.deleteMany({
          where: { workshopId: id }
        });
      }

      return tx.workshop.update({
        where: { id },
        data: {
          ...rest,
          equipment: extras,
          workshopTools:
            workshopTools !== undefined
              ? {
                  create: workshopTools.map((tool) => ({
                    name: tool.name,
                    category: tool.category
                  }))
                }
              : undefined
        },
        include: {
          workshopTools: {
            select: {
              id: true,
              name: true,
              category: true
            }
          }
        }
      });
    });
  },

  remove(id: string) {
    return prisma.workshop.delete({ where: { id } });
  },

  findActiveBooking(workshopId: string) {
    return prisma.booking.findFirst({
      where: {
        timeslot: { workshopId },
        status: { in: ["PENDING", "ACCEPTED"] }
      }
    });
  },

  findOverlappingTimeslot(workshopId: string, startTime: Date, endTime: Date, excludeTimeslotId?: string) {
    return prisma.timeSlot.findFirst({
      where: {
        workshopId,
        id: excludeTimeslotId ? { not: excludeTimeslotId } : undefined,
        startTime: { lt: endTime },
        endTime: { gt: startTime }
      }
    });
  },

  createTimeslot(input: { workshopId: string; startTime: Date; endTime: Date; blockedByOwner: boolean }) {
    return prisma.timeSlot.create({
      data: {
        workshopId: input.workshopId,
        startTime: input.startTime,
        endTime: input.endTime,
        blockedByOwner: input.blockedByOwner
      }
    });
  },

  createBlockedTimeslotWithAvailabilitySplit(input: { workshopId: string; startTime: Date; endTime: Date }) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const overlapping = await tx.timeSlot.findMany({
        where: {
          workshopId: input.workshopId,
          startTime: { lt: input.endTime },
          endTime: { gt: input.startTime }
        },
        orderBy: { startTime: "asc" }
      });

      const overlappingBlocked = overlapping.filter((slot) => slot.blockedByOwner);
      if (overlappingBlocked.length > 0) {
        return "BLOCKED_CONFLICT" as const;
      }

      const overlappingAvailable = overlapping.filter((slot) => !slot.blockedByOwner);
      if (overlappingAvailable.length > 0) {
        const slotIds = overlappingAvailable.map((slot) => slot.id);
        const activeBooking = await tx.booking.findFirst({
          where: {
            timeslotId: { in: slotIds },
            status: { in: ["PENDING", "ACCEPTED"] },
            startDate: { lt: input.endTime },
            endDate: { gt: input.startTime }
          }
        });
        if (activeBooking) {
          return "ACTIVE_BOOKING_EXISTS" as const;
        }

        await tx.timeSlot.deleteMany({
          where: {
            id: { in: slotIds }
          }
        });

        const replacementSlots: Array<{
          workshopId: string;
          startTime: Date;
          endTime: Date;
          blockedByOwner: boolean;
        }> = [];

        for (const slot of overlappingAvailable) {
          if (slot.startTime < input.startTime) {
            replacementSlots.push({
              workshopId: input.workshopId,
              startTime: slot.startTime,
              endTime: input.startTime,
              blockedByOwner: false
            });
          }

          if (slot.endTime > input.endTime) {
            replacementSlots.push({
              workshopId: input.workshopId,
              startTime: input.endTime,
              endTime: slot.endTime,
              blockedByOwner: false
            });
          }
        }

        if (replacementSlots.length > 0) {
          await tx.timeSlot.createMany({
            data: replacementSlots
          });
        }
      }

      const blockedSlot = await tx.timeSlot.create({
        data: {
          workshopId: input.workshopId,
          startTime: input.startTime,
          endTime: input.endTime,
          blockedByOwner: true
        }
      });

      return blockedSlot;
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

  updateTimeslot(
    id: string,
    data: {
      startTime?: Date;
      endTime?: Date;
      blockedByOwner?: boolean;
    }
  ) {
    return prisma.timeSlot.update({
      where: { id },
      data
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
