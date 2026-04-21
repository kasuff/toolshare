import { prisma } from "../../config/prisma";

export const authRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  createUser(input: {
    email: string;
    passwordHash: string;
    name: string;
    address: string;
    role: "USER" | "MODERATOR" | "MANAGER";
  }) {
    return prisma.user.create({ data: input });
  }
};
