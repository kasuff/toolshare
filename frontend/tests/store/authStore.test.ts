import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../src/store/authStore";
import { notifySessionExpired, SESSION_EXPIRED_MESSAGE } from "@toolshare/shared";

const { login, register, getCurrentUser, updateMyProfile, refresh, logout } = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  getCurrentUser: vi.fn(),
  updateMyProfile: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn()
}));

vi.mock("@toolshare/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@toolshare/shared")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      login,
      register,
      getCurrentUser,
      updateMyProfile,
      refresh,
      logout
    }
  };
});

function resetAuthStore() {
  useAuthStore.setState({
    token: null,
    currentUser: null,
    isLoading: false,
    error: null
  });
}

describe("authStore", () => {
  beforeEach(() => {
    if (typeof localStorage?.clear === "function") {
      localStorage.clear();
    }
    login.mockReset();
    register.mockReset();
    getCurrentUser.mockReset();
    updateMyProfile.mockReset();
    refresh.mockReset();
    logout.mockReset();
    logout.mockResolvedValue(undefined);
    resetAuthStore();
  });

  it("loads the current user from a stored token and handles logout", async () => {
    refresh.mockResolvedValueOnce({ accessToken: "stored-token", refreshToken: "rt" });
    getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      name: "Lea",
      email: "lea@toolshare.local",
      role: "NUTZER",
      isSuspended: false
    });

    await act(async () => {
      await useAuthStore.getState().initSession();
    });

    await waitFor(() => expect(useAuthStore.getState().isLoading).toBe(false));
    expect(useAuthStore.getState().currentUser?.name).toBe("Lea");

    act(() => {
      useAuthStore.getState().logout();
    });

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().currentUser).toBeNull();
  });

  it("clears an expired session immediately", async () => {
    refresh.mockResolvedValueOnce({ accessToken: "expired-token", refreshToken: "rt" });
    getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      name: "Lea",
      email: "lea@toolshare.local",
      role: "NUTZER",
      isSuspended: false
    });

    await act(async () => {
      await useAuthStore.getState().initSession();
    });

    await waitFor(() => expect(useAuthStore.getState().currentUser?.name).toBe("Lea"));

    act(() => {
      notifySessionExpired();
    });

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().currentUser).toBeNull();
    expect(useAuthStore.getState().error).toBe(SESSION_EXPIRED_MESSAGE);
  });

  it("persists tokens on login and register", async () => {
    login.mockResolvedValueOnce({ accessToken: "login-token", refreshToken: "login-refresh" });
    register.mockResolvedValueOnce({ accessToken: "register-token", refreshToken: "register-refresh" });
    getCurrentUser
      .mockResolvedValueOnce({
        id: "u1",
        name: "Lea",
        email: "lea@toolshare.local",
        role: "NUTZER",
        isSuspended: false
      })
      .mockResolvedValueOnce({
        id: "u2",
        name: "Nina",
        email: "nina@toolshare.local",
        role: "NUTZER",
        isSuspended: false
      });

    await act(async () => {
      await useAuthStore.getState().login("lea@toolshare.local", "password123");
    });

    expect(login).toHaveBeenCalledWith("lea@toolshare.local", "password123");
    expect(useAuthStore.getState().token).toBe("login-token");

    await act(async () => {
      await useAuthStore.getState().register({
        email: "nina@toolshare.local",
        password: "password123",
        name: "Nina",
        address: "Musterstraße 1"
      });
    });

    expect(register).toHaveBeenCalledWith({
      email: "nina@toolshare.local",
      password: "password123",
      name: "Nina",
      address: "Musterstraße 1"
    });
    expect(useAuthStore.getState().token).toBe("register-token");
  });

  it("updates profile for logged-in users and rejects guest updates", async () => {
    await expect(useAuthStore.getState().updateProfile({ name: "Guest" })).rejects.toThrow(
      "Du musst eingeloggt sein."
    );

    login.mockResolvedValueOnce({ accessToken: "profile-token", refreshToken: "profile-refresh" });
    getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      name: "Lea",
      email: "lea@toolshare.local",
      role: "NUTZER",
      isSuspended: false
    });
    updateMyProfile.mockResolvedValueOnce({
      id: "u1",
      name: "Lea Neu",
      email: "lea@toolshare.local",
      role: "NUTZER",
      isSuspended: false
    });

    await act(async () => {
      await useAuthStore.getState().login("lea@toolshare.local", "password123");
    });

    await waitFor(() => expect(useAuthStore.getState().currentUser?.name).toBe("Lea"));

    await act(async () => {
      await useAuthStore.getState().updateProfile({ name: "Lea Neu" });
    });

    expect(updateMyProfile).toHaveBeenCalledWith({ name: "Lea Neu" }, "profile-token");
    expect(useAuthStore.getState().currentUser?.name).toBe("Lea Neu");
  });
});
