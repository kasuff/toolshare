import { prisma } from "../../config/prisma";

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  address: true,
  role: true,
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

  updateProfile(id: string, data: { name?: string; address?: string }) {
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
  }
};