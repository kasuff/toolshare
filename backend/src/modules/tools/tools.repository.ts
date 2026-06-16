import { prisma } from "../../config/prisma";

export const toolsRepository = {
  list(filters: {
    category?: string;
    status?: "AVAILABLE" | "REQUESTED" | "BORROWED";
    ownerId?: string;
    search?: string;
  }) {
    return prisma.tool.findMany({
      where: {
        ownerId: filters.ownerId,
        status: filters.status,
        category: filters.category
          ? { contains: filters.category, mode: "insensitive" }
          : undefined,
        OR: filters.search
          ? [
              { name: { contains: filters.search, mode: "insensitive" } },
              { description: { contains: filters.search, mode: "insensitive" } },
              { category: { contains: filters.search, mode: "insensitive" } },
              { pickupLocation: { contains: filters.search, mode: "insensitive" } }
            ]
          : undefined
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  },

  findById(id: string) {
    return prisma.tool.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            role: true
          }
        }
      }
    });
  },

  findActiveBooking(toolId: string) {
    return prisma.booking.findFirst({
      where: {
        toolId,
        status: { in: ["PENDING", "ACCEPTED"] }
      }
    });
  },

  // Liefert die belegten Zeiträume eines Werkzeugs für die Kalenderansicht
  // (durchgestrichen). Bewusst ohne Nutzeridentität.
  findActiveBookingRanges(toolId: string) {
    return prisma.booking.findMany({
      where: {
        toolId,
        status: { in: ["PENDING", "ACCEPTED"] }
      },
      select: { id: true, startDate: true, endDate: true, status: true },
      orderBy: { startDate: "asc" }
    });
  },

  listBlockingPeriods(toolId: string) {
    return prisma.booking.findMany({
      where: {
        toolId,
        status: { in: ["PENDING", "ACCEPTED"] }
      },
      select: {
        startDate: true,
        endDate: true
      },
      orderBy: { startDate: "asc" }
    });
  },

  create(input: {
    ownerId: string;
    name: string;
    description: string;
    category: string;
    imageUrl?: string;
    pickupLocation: string;
    pickupLocationNote?: string;
  }) {
    return prisma.tool.create({
      data: {
        ownerId: input.ownerId,
        name: input.name,
        description: input.description,
        category: input.category,
        imageUrl: input.imageUrl,
        pickupLocation: input.pickupLocation,
        pickupLocationNote: input.pickupLocationNote,
        status: "AVAILABLE"
      }
    });
  },

  update(
    id: string,
    input: {
      name?: string;
      description?: string;
      category?: string;
      imageUrl?: string;
      pickupLocation?: string;
      pickupLocationNote?: string;
      status?: "AVAILABLE" | "REQUESTED" | "BORROWED";
    }
  ) {
    return prisma.tool.update({
      where: { id },
      data: input
    });
  },

  remove(id: string) {
    return prisma.tool.delete({ where: { id } });
  }
};
