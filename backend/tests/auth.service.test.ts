import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authService } from "../src/modules/auth/services/auth.service";
import { authRepository } from "../src/modules/auth/repositories/auth.repository";

vi.mock("../src/modules/auth/repositories/auth.repository", () => ({
  authRepository: {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    createUser: vi.fn(),
    findCredentialsById: vi.fn(),
    updatePassword: vi.fn(),
    createRefreshToken: vi.fn(),
    findRefreshToken: vi.fn(),
    revokeRefreshToken: vi.fn(),
    revokeAllRefreshTokensForUser: vi.fn()
  }
}));

vi.mock("../src/modules/address/services/address.service", () => ({
  addressService: {
    geocode: vi.fn().mockResolvedValue({ latitude: 48.137154, longitude: 11.576124 })
  }
}));

const mockedRepo = vi.mocked(authRepository);

const USER_ID = "11111111-1111-1111-1111-111111111111";
const EMAIL = "user@example.com";
const PASSWORD = "ValidPass123!";

describe("authService.register", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws EMAIL_ALREADY_EXISTS when the email is already registered", async () => {
    mockedRepo.findByEmail.mockResolvedValueOnce({ id: USER_ID } as never);

    await expect(
      authService.register({
        email: EMAIL,
        password: PASSWORD,
        name: "Test User",
        address: "Musterstraße 1"
      })
    ).rejects.toMatchObject({ code: "EMAIL_ALREADY_EXISTS", status: 409 });

    expect(mockedRepo.createUser).not.toHaveBeenCalled();
  });

  it("creates a user with a bcrypt hash and returns auth payload", async () => {
    mockedRepo.findByEmail.mockResolvedValueOnce(null);
    mockedRepo.createUser.mockResolvedValueOnce({
      id: USER_ID,
      email: EMAIL,
      role: "USER",
      name: "Test User"
    } as never);

    const result = await authService.register({
      email: EMAIL,
      password: PASSWORD,
      name: "Test User",
      address: "Musterstraße 1"
    });

    expect(result.user).toEqual({
      id: USER_ID,
      email: EMAIL,
      role: "USER",
      name: "Test User"
    });
    expect(result.accessToken).toBeTypeOf("string");
    expect(result.refreshToken).toBeTypeOf("string");

    const createInput = mockedRepo.createUser.mock.calls[0][0];
    expect(createInput).toMatchObject({
      email: EMAIL,
      name: "Test User",
      address: "Musterstraße 1",
      role: "USER"
    });
    expect(await bcrypt.compare(PASSWORD, createInput.passwordHash)).toBe(true);
  });
});

describe("authService.login", () => {
  beforeEach(() => vi.clearAllMocks());

  const seedUser = async (overrides: { isSuspended?: boolean } = {}) => {
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    mockedRepo.findByEmail.mockResolvedValueOnce({
      id: USER_ID,
      email: EMAIL,
      passwordHash,
      name: "Test User",
      role: "USER",
      isSuspended: overrides.isSuspended ?? false
    } as never);
    return passwordHash;
  };

  it("throws INVALID_CREDENTIALS when the email is unknown", async () => {
    mockedRepo.findByEmail.mockResolvedValueOnce(null);

    await expect(authService.login({ email: EMAIL, password: PASSWORD })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      status: 401
    });
  });

  it("throws ACCOUNT_SUSPENDED for suspended accounts", async () => {
    await seedUser({ isSuspended: true });

    await expect(authService.login({ email: EMAIL, password: PASSWORD })).rejects.toMatchObject({
      code: "ACCOUNT_SUSPENDED",
      status: 403
    });
  });

  it("throws INVALID_CREDENTIALS when the password does not match", async () => {
    await seedUser();

    await expect(authService.login({ email: EMAIL, password: "WrongPass123!" })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      status: 401
    });
  });

  it("returns tokens for valid credentials", async () => {
    await seedUser();

    const result = await authService.login({ email: EMAIL, password: PASSWORD });

    expect(result.user).toMatchObject({ id: USER_ID, email: EMAIL, role: "USER" });
    expect(result.accessToken).toBeTypeOf("string");
    expect(result.refreshToken).toBeTypeOf("string");
  });
});

describe("authService.refresh", () => {
  // resetAllMocks (statt clearAllMocks) leert auch die mockResolvedValueOnce-Queues,
  // sonst lecken nicht konsumierte Once-Werte zwischen den Tests.
  beforeEach(() => vi.resetAllMocks());

  const signRefreshToken = (payload: { userId: string; role: "USER" | "MODERATOR" | "MANAGER" }) =>
    jwt.sign(payload, (process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET) as string, { expiresIn: "7d" });

  const storedToken = () => ({
    userId: USER_ID,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  it("throws UNAUTHORIZED for an invalid refresh token", async () => {
    await expect(authService.refresh("not-a-valid-token")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401
    });
  });

  it("throws UNAUTHORIZED when the user no longer exists", async () => {
    const refreshToken = signRefreshToken({ userId: USER_ID, role: "USER" });
    mockedRepo.findRefreshToken.mockResolvedValue(storedToken() as never);
    mockedRepo.findById.mockResolvedValue(null);

    await expect(authService.refresh(refreshToken)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401
    });
  });

  it("throws UNAUTHORIZED when the refresh token is unknown or already revoked", async () => {
    const refreshToken = signRefreshToken({ userId: USER_ID, role: "USER" });
    mockedRepo.findRefreshToken.mockResolvedValue(null);

    await expect(authService.refresh(refreshToken)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401
    });
  });

  it("revokes all sessions when a revoked token is reused", async () => {
    const refreshToken = signRefreshToken({ userId: USER_ID, role: "USER" });
    mockedRepo.findRefreshToken.mockResolvedValue({
      ...storedToken(),
      revokedAt: new Date()
    } as never);

    await expect(authService.refresh(refreshToken)).rejects.toMatchObject({ status: 401 });
    expect(mockedRepo.revokeAllRefreshTokensForUser).toHaveBeenCalledWith(USER_ID);
  });

  it("throws ACCOUNT_SUSPENDED when the user is suspended", async () => {
    const refreshToken = signRefreshToken({ userId: USER_ID, role: "USER" });
    mockedRepo.findRefreshToken.mockResolvedValue(storedToken() as never);
    mockedRepo.findById.mockResolvedValueOnce({
      id: USER_ID,
      role: "USER",
      isSuspended: true
    } as never);

    await expect(authService.refresh(refreshToken)).rejects.toMatchObject({
      code: "ACCOUNT_SUSPENDED",
      status: 403
    });
  });

  it("rotates tokens for a valid refresh token (revokes old, issues new)", async () => {
    const refreshToken = signRefreshToken({ userId: USER_ID, role: "USER" });
    mockedRepo.findRefreshToken.mockResolvedValue(storedToken() as never);
    mockedRepo.findById.mockResolvedValueOnce({
      id: USER_ID,
      role: "USER",
      isSuspended: false
    } as never);

    const result = await authService.refresh(refreshToken);

    expect(result.accessToken).toBeTypeOf("string");
    expect(result.refreshToken).toBeTypeOf("string");
    expect(mockedRepo.revokeRefreshToken).toHaveBeenCalledTimes(1);
    expect(mockedRepo.createRefreshToken).toHaveBeenCalledTimes(1);
    const accessPayload = jwt.verify(result.accessToken, process.env.JWT_SECRET as string) as {
      userId: string;
      role: string;
    };
    expect(accessPayload).toMatchObject({ userId: USER_ID, role: "USER" });
  });
});

describe("authService.logout", () => {
  beforeEach(() => vi.clearAllMocks());

  const signRefreshToken = (payload: { userId: string; role: "USER" | "MODERATOR" | "MANAGER" }) =>
    jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: "7d" });

  it("revokes the presented refresh token", async () => {
    const refreshToken = signRefreshToken({ userId: USER_ID, role: "USER" });
    await authService.logout(refreshToken);
    expect(mockedRepo.revokeRefreshToken).toHaveBeenCalledTimes(1);
  });

  it("is a no-op for an empty token", async () => {
    await authService.logout("");
    expect(mockedRepo.revokeRefreshToken).not.toHaveBeenCalled();
  });
});