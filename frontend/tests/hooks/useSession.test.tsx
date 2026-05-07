import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSession } from "../../src/hooks/useSession";

const { login, register, getCurrentUser } = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  getCurrentUser: vi.fn()
}));

vi.mock("../../src/services/api", () => ({
  api: {
    login,
    register,
    getCurrentUser
  }
}));

describe("useSession", () => {
  beforeEach(() => {
    localStorage.clear();
    login.mockReset();
    register.mockReset();
    getCurrentUser.mockReset();
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
});
