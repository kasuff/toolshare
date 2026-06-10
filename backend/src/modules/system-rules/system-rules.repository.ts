import { prisma } from "../../config/prisma";

export const systemRulesRepository = {
  list() {
    return prisma.systemRule.findMany({ orderBy: { createdAt: "asc" } });
  },

  findById(id: string) {
    return prisma.systemRule.findUnique({ where: { id } });
  },

  create(text: string) {
    return prisma.systemRule.create({ data: { text } });
  },

  update(id: string, text: string) {
    return prisma.systemRule.update({ where: { id }, data: { text } });
  },

  remove(id: string) {
    return prisma.systemRule.delete({ where: { id } });
  }
};
