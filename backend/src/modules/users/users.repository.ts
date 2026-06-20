import { prisma } from "../../config/prisma";

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  address: true,
  role: true,
  isSuspended: true,
  expoPushToken: true,
  createdAt: true
} as const;

export const usersRepository = {
  findByIdPublic(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: publicUserSelect
    });
  },

  listPublic(filters: { role?: "USER" | "MODERATOR" | "MANAGER"; search?: string }) {
    const where = {
      role: filters.role,
      OR: filters.search
        ? [
            { name: { contains: filters.search, mode: "insensitive" as const } },
            { email: { contains: filters.search, mode: "insensitive" as const } },
            { address: { contains: filters.search, mode: "insensitive" as const } }
          ]
        : undefined
    };

    return prisma.user.findMany({
      where,
      select: publicUserSelect,
      orderBy: { createdAt: "desc" }
    });
  },

  updateProfile(id: string, data: { name?: string; address?: string; expoPushToken?: string }) {
    return prisma.user.update({
      where: { id },
      data,
      select: publicUserSelect
    });
  },

  updateRole(id: string, role: "USER" | "MODERATOR" | "MANAGER") {
    return prisma.user.update({
      where: { id },
      data: { role },
      select: publicUserSelect
    });
  },

  updateSuspension(id: string, isSuspended: boolean) {
    return prisma.user.update({
      where: { id },
      data: { isSuspended },
      select: publicUserSelect
    });
  },

  async getSystemMetrics() {
    const [users, tools, workshops, openBookings, openReports, openSuspensionRequests] =
      await prisma.$transaction([
        prisma.user.count(),
        prisma.tool.count(),
        prisma.workshop.count(),
        prisma.booking.count({ where: { status: "PENDING" } }),
        prisma.report.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
        prisma.suspensionRequest.count({ where: { status: "PENDING" } })
      ]);

    return { users, tools, workshops, openBookings, openReports, openSuspensionRequests };
  }
};
