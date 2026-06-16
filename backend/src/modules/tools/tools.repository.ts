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

  // Eigenblockaden des Eigentümers: Selbstbuchungen auf dem eigenen Werkzeug
  // (userId === ownerId). Inklusive id, damit der Eigentümer sie wieder entfernen kann.
  listOwnerBlocks(toolId: string, ownerId: string) {
    return prisma.booking.findMany({
      where: {
        toolId,
        userId: ownerId,
        status: { in: ["PENDING", "ACCEPTED"] }
      },
      select: {
        id: true,
        startDate: true,
        endDate: true
      },
      orderBy: { startDate: "asc" }
    });
  },

  // Entfernt eine Eigenblockade. Nur erlaubt, wenn die Buchung eine Selbstbuchung
  // des Eigentümers auf dem eigenen Werkzeug ist.
  async deleteOwnerBlock(bookingId: string, ownerId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { tool: true }
    });
    if (!booking || !booking.toolId || !booking.tool) {
      return "NOT_FOUND" as const;
    }
    if (booking.tool.ownerId !== ownerId || booking.userId !== ownerId) {
      return "FORBIDDEN" as const;
    }
    await prisma.booking.delete({ where: { id: bookingId } });
    return "OK" as const;
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
