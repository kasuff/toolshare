import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { User, api, onSessionExpired, ACCESS_TOKEN_STORAGE_KEY } from '@toolshare/shared';
import { useRouter, useSegments } from 'expo-router';
import { Platform } from 'react-native';
import { getErrorMessage } from '../utils/errors';

const TOKEN_KEY = ACCESS_TOKEN_STORAGE_KEY;

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

type AuthContextType = {
  currentUser?: User;
  token: string | null;
  isLoaded: boolean;
  login: (newToken: string) => Promise<void>;
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
    await storage.deleteItem(TOKEN_KEY);
    setToken(null);
    setCurrentUser(undefined);
    router.replace('/login');
  }, [router]);

  useEffect(() => {
    async function loadSession() {
      try {
        const storedToken = await storage.getItem(TOKEN_KEY);
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
          await storage.deleteItem(TOKEN_KEY);
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

  const login = async (newToken: string) => {
    await storage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    const user = await api.getCurrentUser(newToken);
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
