import { create } from 'zustand';
import {
  api,
  onSessionExpired,
  SESSION_EXPIRED_MESSAGE,
  ACCESS_TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
  configureAuthSession,
  type User,
} from '@toolshare/shared';

const ACCESS_KEY = ACCESS_TOKEN_STORAGE_KEY;
const REFRESH_KEY = REFRESH_TOKEN_STORAGE_KEY;

function persistTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

function clearPersistedTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

interface AuthState {
  token: string | null;
  currentUser: User | null;
  isLoading: boolean;
  error: string | null;
  
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; name: string; address: string; }) => Promise<void>;
  logout: () => void;
  updateProfile: (input: { name?: string; address?: string }) => Promise<User>;
  initSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: typeof localStorage !== 'undefined' ? localStorage.getItem(ACCESS_KEY) : null,
  currentUser: null,
  isLoading: true,
  error: null,

  login: async (email, password) => {
    try {
      const result = await api.login(email, password);
      persistTokens(result.accessToken, result.refreshToken);
      set({ token: result.accessToken, error: null });
      await get().initSession();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Anmeldung fehlgeschlagen." });
      throw err;
    }
  },

  register: async (input) => {
    try {
      const result = await api.register(input);
      persistTokens(result.accessToken, result.refreshToken);
      set({ token: result.accessToken, error: null });
      await get().initSession();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Registrierung fehlgeschlagen." });
      throw err;
    }
  },

  logout: () => {
    clearPersistedTokens();
    set({ token: null, currentUser: null, error: null });
  },

  updateProfile: async (input) => {
    const { token } = get();
    if (!token) throw new Error("Du musst eingeloggt sein.");
    const nextUser = await api.updateMyProfile(input, token);
    set({ currentUser: nextUser });
    return nextUser;
  },

  initSession: async () => {
    const { token } = get();
    if (!token) {
      set({ currentUser: null, isLoading: false });
      return;
    }

    set({ isLoading: true });
    try {
      const me = await api.getCurrentUser(token);
      set({ currentUser: me, error: null });
    } catch (err) {
      clearPersistedTokens();
      set({ 
        token: null, 
        currentUser: null, 
        error: err instanceof Error ? err.message : "Session konnte nicht geladen werden." 
      });
    } finally {
      set({ isLoading: false });
    }
  }
}));

configureAuthSession({
  getAccessToken: () => localStorage.getItem(ACCESS_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_KEY),
  setTokens: ({ accessToken, refreshToken }) => {
    persistTokens(accessToken, refreshToken);
    useAuthStore.setState({ token: accessToken });
  },
  clearTokens: () => {
    clearPersistedTokens();
  },
});

// Handle token expiration events triggered by the api client centrally
onSessionExpired(() => {
  clearPersistedTokens();
  useAuthStore.setState({ 
    token: null, 
    currentUser: null, 
    error: SESSION_EXPIRED_MESSAGE,
    isLoading: false
  });
});
