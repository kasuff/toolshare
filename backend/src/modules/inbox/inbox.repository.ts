import { prisma } from "../../config/prisma";

export const inboxRepository = {
  async listKeys(userId: string): Promise<string[]> {
    const rows = await prisma.inboxReadReceipt.findMany({
      where: { userId },
      select: { messageKey: true }
    });
    return rows.map((row) => row.messageKey);
  },

  // Idempotent: bereits vorhandene (userId, messageKey)-Paare werden dank
  // @@unique + skipDuplicates ignoriert. Deckt sowohl normales Markieren als
  // auch das einmalige Seeding (inkl. __seeded__-Marker) ab.
  async addKeys(userId: string, messageKeys: string[]): Promise<void> {
    if (messageKeys.length === 0) return;
    const unique = Array.from(new Set(messageKeys));
    await prisma.inboxReadReceipt.createMany({
      data: unique.map((messageKey) => ({ userId, messageKey })),
      skipDuplicates: true
    });
  }
};
