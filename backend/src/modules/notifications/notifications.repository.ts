import { prisma } from "../../config/prisma";

export const notificationsRepository = {
  listByUser(userId: string) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
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
