import { create } from 'zustand';
import {
  api,
  onSessionExpired,
  SESSION_EXPIRED_MESSAGE,
  configureAuthSession,
  type User,
} from '@toolshare/shared';

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
  // Kein persistierter Token mehr — Access-Token lebt nur im Zustand-Store (in-memory).
  // Beim Seitenaufruf holt initSession den Token über den rt-Cookie neu.
  token: null,
  currentUser: null,
  isLoading: true,
  error: null,

  login: async (email, password) => {
    try {
      const result = await api.login(email, password);
      // Server setzt at-Cookie (httpOnly). accessToken zusätzlich in State für
      // SSE-Stream und 401-Retry-Logik; kein localStorage-Schreiben mehr.
      set({ token: result.accessToken, error: null });
      const me = await api.getCurrentUser(result.accessToken);
      set({ currentUser: me });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Anmeldung fehlgeschlagen." });
      throw err;
    }
  },

  register: async (input) => {
    try {
      const result = await api.register(input);
      set({ token: result.accessToken, error: null });
      const me = await api.getCurrentUser(result.accessToken);
      set({ currentUser: me });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Registrierung fehlgeschlagen." });
      throw err;
    }
  },

  logout: () => {
    // Refresh-Token serverseitig entwerten — Browser sendet rt- und at-Cookie automatisch.
    // Server löscht beide Cookies. Kein localStorage zu leeren.
    void api.logout().catch(() => undefined);
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
    set({ isLoading: true });
    try {
      // Kein Token im localStorage → immer zuerst Refresh aufrufen.
      // Browser sendet rt-Cookie automatisch; Server antwortet mit neuem at-Cookie
      // und gibt accessToken im Body zurück.
      const refreshed = await api.refresh();
      set({ token: refreshed.accessToken });
      const me = await api.getCurrentUser(refreshed.accessToken);
      set({ currentUser: me, error: null });
    } catch {
      // rt-Cookie fehlt oder abgelaufen → nicht eingeloggt. Kein Fehler anzeigen.
      set({ token: null, currentUser: null });
    } finally {
      set({ isLoading: false });
    }
  }
}));

configureAuthSession({
  getAccessToken: () => useAuthStore.getState().token,
  // Refresh-Token liegt im httpOnly-Cookie — nicht per JS lesbar.
  getRefreshToken: () => null,
  setTokens: ({ accessToken }) => {
    useAuthStore.setState({ token: accessToken });
  },
  clearTokens: () => {
    useAuthStore.setState({ token: null });
  },
  useCookieForRefresh: true,
});

onSessionExpired(() => {
  useAuthStore.setState({
    token: null,
    currentUser: null,
    error: SESSION_EXPIRED_MESSAGE,
    isLoading: false
  });
});
