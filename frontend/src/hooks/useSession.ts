import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { SESSION_EXPIRED_EVENT, SESSION_EXPIRED_MESSAGE } from "../services/sessionEvents";
import type { User } from "../types/domain";

const TOKEN_STORAGE_KEY = "toolshare_access_token";

export function useSession() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleSessionExpired = () => {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken(null);
      setCurrentUser(null);
      setError(SESSION_EXPIRED_MESSAGE);
      setIsLoading(false);
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setCurrentUser(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const me = await api.getCurrentUser(token);
        setCurrentUser(me);
        setError(null);
      } catch (err) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
        setCurrentUser(null);
        setError(err instanceof Error ? err.message : "Session konnte nicht geladen werden.");
      } finally {
        setIsLoading(false);
      }
    };

    void run();
  }, [token]);

  const login = async (email: string, password: string) => {
    try {
      const result = await api.login(email, password);
      localStorage.setItem(TOKEN_STORAGE_KEY, result.accessToken);
      setToken(result.accessToken);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anmeldung fehlgeschlagen.");
      throw err;
    }
  };

  const register = async (input: {
    email: string;
    password: string;
    name: string;
    address: string;
  }) => {
    try {
      const result = await api.register(input);
      localStorage.setItem(TOKEN_STORAGE_KEY, result.accessToken);
      setToken(result.accessToken);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registrierung fehlgeschlagen.");
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setCurrentUser(null);
    setError(null);
  };

  const updateProfile = async (input: { name?: string; address?: string }) => {
    if (!token) {
      throw new Error("Du musst eingeloggt sein.");
    }
    const nextUser = await api.updateMyProfile(input, token);
    setCurrentUser(nextUser);
    return nextUser;
  };

  const users = useMemo(() => (currentUser ? [currentUser] : []), [currentUser]);

  return {
    token,
    users,
    currentUser,
    isLoading,
    error,
    login,
    register,
    logout,
    updateProfile
  };
}
