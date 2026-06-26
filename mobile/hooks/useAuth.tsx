import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  User,
  api,
  onSessionExpired,
  ACCESS_TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
  configureAuthSession,
  type AuthTokens,
} from '@toolshare/shared';
import { useRouter, useSegments } from 'expo-router';
import { Platform } from 'react-native';
import { getErrorMessage } from '../utils/errors';

const ACCESS_KEY = ACCESS_TOKEN_STORAGE_KEY;
const REFRESH_KEY = REFRESH_TOKEN_STORAGE_KEY;

// Web fallback for SecureStore since browsers do not have keychains
const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },
  deleteItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    return SecureStore.deleteItemAsync(key);
  }
};

async function persistTokens({ accessToken, refreshToken }: AuthTokens) {
  await storage.setItem(ACCESS_KEY, accessToken);
  await storage.setItem(REFRESH_KEY, refreshToken);
}

async function clearPersistedTokens() {
  await storage.deleteItem(ACCESS_KEY);
  await storage.deleteItem(REFRESH_KEY);
}

type AuthContextType = {
  currentUser?: User;
  token: string | null;
  isLoaded: boolean;
  login: (tokens: AuthTokens) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (input: { name?: string; address?: string }) => Promise<User | undefined>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | undefined>();
  const [token, setToken] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  const logout = useCallback(async () => {
    await clearPersistedTokens();
    setToken(null);
    setCurrentUser(undefined);
    router.replace('/login');
  }, [router]);

  useEffect(() => {
    configureAuthSession({
      getAccessToken: () => storage.getItem(ACCESS_KEY),
      getRefreshToken: () => storage.getItem(REFRESH_KEY),
      setTokens: async (tokens) => {
        await persistTokens(tokens);
        setToken(tokens.accessToken);
      },
      clearTokens: () => clearPersistedTokens(),
    });
  }, []);

  useEffect(() => {
    async function loadSession() {
      try {
        const storedToken = await storage.getItem(ACCESS_KEY);
        if (storedToken) {
          const user = await api.getCurrentUser(storedToken);
          setToken(storedToken);
          setCurrentUser(user);
        }
      } catch (e) {
        console.error('Failed to load session:', e);
        if (getErrorMessage(e, '').includes('Netzwerkfehler')) {
          // Keep token for network errors, just set loaded
        } else {
          await clearPersistedTokens();
          setToken(null);
          setCurrentUser(undefined);
        }
      } finally {
        setIsLoaded(true);
      }
    }
    loadSession();

    const unsubscribe = onSessionExpired(() => {
      logout();
    });
    return unsubscribe;
  }, [logout]);

  useEffect(() => {
    if (!isLoaded) return;
    
    const inAuthGroup = segments[0] === '(auth)';
    
    if (!token && !inAuthGroup) {
      router.replace('/login');
    } else if (token && inAuthGroup) {
      router.replace('/tools');
    }
  }, [token, isLoaded, segments, router]);

  const login = async (tokens: AuthTokens) => {
    await persistTokens(tokens);
    setToken(tokens.accessToken);
    const user = await api.getCurrentUser(tokens.accessToken);
    setCurrentUser(user);
  };

  const updateProfile = async (input: { name?: string; address?: string }) => {
    if (!token) return;
    const nextUser = await api.updateMyProfile(input, token);
    setCurrentUser(nextUser);
    return nextUser;
  };

  return (
    <AuthContext.Provider value={{ currentUser, token, isLoaded, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
