import bcrypt from "bcrypt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authService } from "../src/modules/auth/auth.service";
import { authRepository } from "../src/modules/auth/auth.repository";

vi.mock("../src/modules/auth/auth.repository", () => ({
  authRepository: {
    findCredentialsById: vi.fn(),
    updatePassword: vi.fn()
  }
}));

const mockedRepo = vi.mocked(authRepository);

const USER_ID = "11111111-1111-1111-1111-111111111111";
const CURRENT_PASSWORD = "CurrentPass123";

describe("authService.changePassword", () => {
  beforeEach(() => vi.clearAllMocks());

  const seedUser = async () => {
    const passwordHash = await bcrypt.hash(CURRENT_PASSWORD, 4);
    mockedRepo.findCredentialsById.mockResolvedValueOnce({ id: USER_ID, passwordHash } as never);
    return passwordHash;
  };

  it("throws UNAUTHORIZED when the user does not exist", async () => {
    mockedRepo.findCredentialsById.mockResolvedValueOnce(null);

    await expect(
      authService.changePassword({
        userId: USER_ID,
        currentPassword: CURRENT_PASSWORD,
        newPassword: "NewPass1234"
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
    expect(mockedRepo.updatePassword).not.toHaveBeenCalled();
  });

  it("throws INVALID_CURRENT_PASSWORD when the current password is wrong", async () => {
    await seedUser();

    await expect(
      authService.changePassword({
        userId: USER_ID,
        currentPassword: "WrongPassword",
        newPassword: "NewPass1234"
      })
    ).rejects.toMatchObject({ code: "INVALID_CURRENT_PASSWORD", status: 400 });
    expect(mockedRepo.updatePassword).not.toHaveBeenCalled();
  });

  it("throws PASSWORD_UNCHANGED when the new password equals the current one", async () => {
    await seedUser();

    await expect(
      authService.changePassword({
        userId: USER_ID,
        currentPassword: CURRENT_PASSWORD,
        newPassword: CURRENT_PASSWORD
      })
    ).rejects.toMatchObject({ code: "PASSWORD_UNCHANGED", status: 400 });
    expect(mockedRepo.updatePassword).not.toHaveBeenCalled();
  });

  it("stores a new bcrypt hash when the current password matches", async () => {
    await seedUser();
    mockedRepo.updatePassword.mockResolvedValueOnce({ id: USER_ID } as never);

    await authService.changePassword({
      userId: USER_ID,
      currentPassword: CURRENT_PASSWORD,
      newPassword: "NewPass1234"
    });

    expect(mockedRepo.updatePassword).toHaveBeenCalledTimes(1);
    const [calledUserId, storedHash] = mockedRepo.updatePassword.mock.calls[0];
    expect(calledUserId).toBe(USER_ID);
    // Der gespeicherte Hash darf nicht das Klartext-Passwort sein und muss verifizieren.
    expect(storedHash).not.toBe("NewPass1234");
    expect(await bcrypt.compare("NewPass1234", storedHash)).toBe(true);
  });
});
