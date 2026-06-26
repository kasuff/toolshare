import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  api,
  onSessionExpired,
  ACCESS_TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
  configureAuthSession,
  type AuthTokens,
  type User,
} from '@toolshare/shared';
import { getErrorMessage } from '../utils/errors';

const ACCESS_KEY = ACCESS_TOKEN_STORAGE_KEY;
const REFRESH_KEY = REFRESH_TOKEN_STORAGE_KEY;

// Web hat keine Keychain, daher Fallback auf localStorage – analog zum bisherigen
// AuthProvider. Die Token-Persistenz ist auf Mobile zwingend asynchron (SecureStore),
// deshalb wird der Token – anders als im Web-authStore – nicht synchron initialisiert,
// sondern per initSession() beim App-Start nachgeladen.
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
  },
};

async function persistTokens({ accessToken, refreshToken }: AuthTokens) {
  await storage.setItem(ACCESS_KEY, accessToken);
  await storage.setItem(REFRESH_KEY, refreshToken);
}

async function clearPersistedTokens() {
  await storage.deleteItem(ACCESS_KEY);
  await storage.deleteItem(REFRESH_KEY);
}

interface AuthState {
  token: string | null;
  currentUser: User | undefined;
  /** false bis initSession() das gespeicherte Token einmalig geprüft hat. */
  isLoaded: boolean;

  login: (tokens: AuthTokens) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (input: { name?: string; address?: string }) => Promise<User | undefined>;
  initSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  currentUser: undefined,
  isLoaded: false,

  login: async (tokens) => {
    await persistTokens(tokens);
    set({ token: tokens.accessToken });
    const user = await api.getCurrentUser(tokens.accessToken);
    set({ currentUser: user });
  },

  logout: async () => {
    // Refresh-Token serverseitig entwerten (best effort – lokales Logout darf nie
    // an einem fehlgeschlagenen Netzwerkaufruf hängen).
    const refreshToken = await storage.getItem(REFRESH_KEY);
    if (refreshToken) {
      void api.logout(refreshToken).catch(() => undefined);
    }
    await clearPersistedTokens();
    set({ token: null, currentUser: undefined });
  },

  updateProfile: async (input) => {
    const { token } = get();
    if (!token) return;
    const nextUser = await api.updateMyProfile(input, token);
    set({ currentUser: nextUser });
    return nextUser;
  },

  initSession: async () => {
    try {
      const storedToken = await storage.getItem(ACCESS_KEY);
      if (storedToken) {
        const user = await api.getCurrentUser(storedToken);
        set({ token: storedToken, currentUser: user });
      }
    } catch (e) {
      console.error('Failed to load session:', e);
      if (getErrorMessage(e, '').includes('Netzwerkfehler')) {
        // Bei Netzwerkfehlern Token behalten – nur als geladen markieren.
      } else {
        await clearPersistedTokens();
        set({ token: null, currentUser: undefined });
      }
    } finally {
      set({ isLoaded: true });
    }
  },
}));

// Zentrale Anbindung des shared-API-Clients an den Token-Store. Läuft einmalig beim
// Import (analog zum Web-authStore).
configureAuthSession({
  getAccessToken: () => storage.getItem(ACCESS_KEY),
  getRefreshToken: () => storage.getItem(REFRESH_KEY),
  setTokens: async (tokens) => {
    await persistTokens(tokens);
    useAuthStore.setState({ token: tokens.accessToken });
  },
  clearTokens: () => clearPersistedTokens(),
});

// Token-Ablauf, den der API-Client meldet, zentral behandeln. Die Navigation zum
// Login übernimmt der Routing-Guard, der auf token === null reagiert.
onSessionExpired(() => {
  void clearPersistedTokens();
  useAuthStore.setState({ token: null, currentUser: undefined, isLoaded: true });
});
