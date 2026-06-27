import { prisma } from "../../../config/prisma";
import type { PageParams } from "../../../utils/pagination";

export const notificationsRepository = {
  listByUser(userId: string, page: PageParams) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: page.limit,
      skip: page.offset
    });
  },

  markAsRead(id: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true }
    });
  },

  create(userId: string, message: string) {
    return prisma.notification.create({
      data: { userId, message }
    });
  }
};