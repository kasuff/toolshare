import { prisma } from "../../config/prisma";

export const authRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        isSuspended: true
      }
    });
  },

  findCredentialsById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        passwordHash: true
      }
    });
  },

  updatePassword(id: string, passwordHash: string) {
    return prisma.user.update({ where: { id }, data: { passwordHash } });
  },

  createUser(input: {
    email: string;
    passwordHash: string;
    name: string;
    address: string;
    latitude?: number | null;
    longitude?: number | null;
    role: "USER" | "MODERATOR" | "MANAGER";
  }) {
    return prisma.user.create({ data: input });
  }
};
