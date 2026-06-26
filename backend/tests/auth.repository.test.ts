import { beforeEach, describe, expect, it, vi } from "vitest";
import { authRepository } from "../src/modules/auth/auth.repository";

const mocks = vi.hoisted(() => ({
  refreshCreate: vi.fn(),
  refreshFindUnique: vi.fn(),
  refreshUpdateMany: vi.fn()
}));

vi.mock("../src/config/prisma", () => ({
  prisma: {
    refreshToken: {
      create: mocks.refreshCreate,
      findUnique: mocks.refreshFindUnique,
      updateMany: mocks.refreshUpdateMany
    }
  }
}));

const USER_ID = "11111111-1111-1111-1111-111111111111";
const HASH = "a".repeat(64);

describe("authRepository refresh tokens", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a refresh token from userId, hash and expiry", async () => {
    const expiresAt = new Date("2026-07-01T00:00:00.000Z");
    mocks.refreshCreate.mockResolvedValueOnce({ id: "rt1" });

    await authRepository.createRefreshToken({ userId: USER_ID, tokenHash: HASH, expiresAt });

    expect(mocks.refreshCreate).toHaveBeenCalledWith({
      data: { userId: USER_ID, tokenHash: HASH, expiresAt }
    });
  });

  it("looks a refresh token up by its hash", async () => {
    mocks.refreshFindUnique.mockResolvedValueOnce({ id: "rt1", userId: USER_ID });

    const result = await authRepository.findRefreshToken(HASH);

    expect(mocks.refreshFindUnique).toHaveBeenCalledWith({ where: { tokenHash: HASH } });
    expect(result).toMatchObject({ id: "rt1" });
  });

  it("revokes only the matching, still-active token", async () => {
    mocks.refreshUpdateMany.mockResolvedValueOnce({ count: 1 });

    await authRepository.revokeRefreshToken(HASH);

    expect(mocks.refreshUpdateMany).toHaveBeenCalledWith({
      where: { tokenHash: HASH, revokedAt: null },
      data: { revokedAt: expect.any(Date) }
    });
  });

  it("revokes all active tokens of a user", async () => {
    mocks.refreshUpdateMany.mockResolvedValueOnce({ count: 3 });

    await authRepository.revokeAllRefreshTokensForUser(USER_ID);

    expect(mocks.refreshUpdateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, revokedAt: null },
      data: { revokedAt: expect.any(Date) }
    });
  });
});
