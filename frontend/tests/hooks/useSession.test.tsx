import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSession } from "../../src/hooks/useSession";
import { notifySessionExpired, onSessionExpired, SESSION_EXPIRED_MESSAGE } from "@toolshare/shared";

const { login, register, getCurrentUser, updateMyProfile } = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  getCurrentUser: vi.fn(),
  updateMyProfile: vi.fn()
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
    updateMyProfile
    }
  };
});

describe("useSession", () => {
  beforeEach(() => {
    if (typeof localStorage?.clear === "function") {
      localStorage.clear();
    }
    login.mockReset();
    register.mockReset();
    getCurrentUser.mockReset();
    updateMyProfile.mockReset();
  });

  it("loads the current user from a stored token and handles logout", async () => {
    localStorage.setItem("toolshare_access_token", "stored-token");
    getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      name: "Lea",
      email: "lea@toolshare.local",
      role: "NUTZER",
      isSuspended: false
    });

    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.currentUser?.name).toBe("Lea");

    act(() => {
      result.current.logout();
    });

    expect(localStorage.getItem("toolshare_access_token")).toBeNull();
    expect(result.current.currentUser).toBeNull();
  });

  it("clears an expired session immediately", async () => {
    localStorage.setItem("toolshare_access_token", "expired-token");
    getCurrentUser.mockResolvedValueOnce({
      id: "u1",
      name: "Lea",
      email: "lea@toolshare.local",
      role: "NUTZER",
      isSuspended: false
    });

    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.currentUser?.name).toBe("Lea"));

    act(() => {
      notifySessionExpired();
    });

    expect(localStorage.getItem("toolshare_access_token")).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.currentUser).toBeNull();
    expect(result.current.error).toBe(SESSION_EXPIRED_MESSAGE);
  });

  it("persists tokens on login and register", async () => {
    login.mockResolvedValueOnce({ accessToken: "login-token" });
    register.mockResolvedValueOnce({ accessToken: "register-token" });

    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login("lea@toolshare.local", "password123");
    });

    expect(login).toHaveBeenCalledWith("lea@toolshare.local", "password123");
    expect(localStorage.getItem("toolshare_access_token")).toBe("login-token");

    await act(async () => {
      await result.current.register({
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
    expect(localStorage.getItem("toolshare_access_token")).toBe("register-token");
  });

  it("updates profile for logged-in users and rejects guest updates", async () => {
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(result.current.updateProfile({ name: "Guest" })).rejects.toThrow("Du musst eingeloggt sein.");

    login.mockResolvedValueOnce({ accessToken: "profile-token" });
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
      await result.current.login("lea@toolshare.local", "password123");
    });
    await waitFor(() => expect(result.current.currentUser?.name).toBe("Lea"));

    await act(async () => {
      await result.current.updateProfile({ name: "Lea Neu" });
    });

    expect(updateMyProfile).toHaveBeenCalledWith({ name: "Lea Neu" }, "profile-token");
    expect(result.current.currentUser?.name).toBe("Lea Neu");
  });
});
