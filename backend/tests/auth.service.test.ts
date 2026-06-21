import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authService } from "../src/modules/auth/auth.service";
import { authRepository } from "../src/modules/auth/auth.repository";

vi.mock("../src/modules/auth/auth.repository", () => ({
  authRepository: {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    createUser: vi.fn(),
    findCredentialsById: vi.fn(),
    updatePassword: vi.fn()
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
  beforeEach(() => vi.clearAllMocks());

  const signRefreshToken = (payload: { userId: string; role: "USER" | "MODERATOR" | "MANAGER" }) =>
    jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: "7d" });

  it("throws UNAUTHORIZED for an invalid refresh token", async () => {
    await expect(authService.refresh("not-a-valid-token")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401
    });
  });

  it("throws UNAUTHORIZED when the user no longer exists", async () => {
    const refreshToken = signRefreshToken({ userId: USER_ID, role: "USER" });
    mockedRepo.findById.mockResolvedValueOnce(null);

    await expect(authService.refresh(refreshToken)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401
    });
  });

  it("throws ACCOUNT_SUSPENDED when the user is suspended", async () => {
    const refreshToken = signRefreshToken({ userId: USER_ID, role: "USER" });
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

  it("issues new access and refresh tokens for a valid refresh token", async () => {
    const refreshToken = signRefreshToken({ userId: USER_ID, role: "USER" });
    mockedRepo.findById.mockResolvedValueOnce({
      id: USER_ID,
      role: "USER",
      isSuspended: false
    } as never);

    const result = await authService.refresh(refreshToken);

    expect(result.accessToken).toBeTypeOf("string");
    expect(result.refreshToken).toBeTypeOf("string");
    const accessPayload = jwt.verify(result.accessToken, process.env.JWT_SECRET as string) as {
      userId: string;
      role: string;
    };
    expect(accessPayload).toMatchObject({ userId: USER_ID, role: "USER" });
  });
});
