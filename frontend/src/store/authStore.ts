import { create } from 'zustand';
import { api, onSessionExpired, SESSION_EXPIRED_MESSAGE, ACCESS_TOKEN_STORAGE_KEY, type User } from '@toolshare/shared';

const TOKEN_STORAGE_KEY = ACCESS_TOKEN_STORAGE_KEY;

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
  token: typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null,
  currentUser: null,
  isLoading: true,
  error: null,

  login: async (email, password) => {
    try {
      const result = await api.login(email, password);
      localStorage.setItem(TOKEN_STORAGE_KEY, result.accessToken);
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
      localStorage.setItem(TOKEN_STORAGE_KEY, result.accessToken);
      set({ token: result.accessToken, error: null });
      await get().initSession();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Registrierung fehlgeschlagen." });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
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
      localStorage.removeItem(TOKEN_STORAGE_KEY);
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

// Handle token expiration events triggered by the api client centrally
onSessionExpired(() => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  useAuthStore.setState({ 
    token: null, 
    currentUser: null, 
    error: SESSION_EXPIRED_MESSAGE,
    isLoading: false
  });
});
