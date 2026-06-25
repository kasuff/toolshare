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
  },

  createRefreshToken(input: { userId: string; tokenHash: string; expiresAt: Date }) {
    return prisma.refreshToken.create({ data: input });
  },

  findRefreshToken(tokenHash: string) {
    return prisma.refreshToken.findUnique({ where: { tokenHash } });
  },

  /** Widerruft einen einzelnen Refresh-Token (idempotent: betrifft nur aktive). */
  revokeRefreshToken(tokenHash: string) {
    return prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  },

  /** Widerruft alle aktiven Refresh-Tokens eines Nutzers (z. B. nach Passwortwechsel). */
  revokeAllRefreshTokensForUser(userId: string) {
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }
};
