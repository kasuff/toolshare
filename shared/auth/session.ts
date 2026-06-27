/** Shared session token keys used by web (localStorage) and mobile (SecureStore). */
export const ACCESS_TOKEN_STORAGE_KEY = "toolshare_access_token";
export const REFRESH_TOKEN_STORAGE_KEY = "toolshare_refresh_token";

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthSessionAdapter = {
  getAccessToken: () => string | null | Promise<string | null>;
  getRefreshToken: () => string | null | Promise<string | null>;
  setTokens: (tokens: AuthTokens) => void | Promise<void>;
  clearTokens: () => void | Promise<void>;
  /** Web-Clients setzen dieses Flag, wenn der Refresh-Token im httpOnly-Cookie
   *  liegt. Der API-Client sendet dann keinen Token im Body, sondern verlässt
   *  sich auf credentials: 'include'. */
  useCookieForRefresh?: boolean;
};

let sessionAdapter: AuthSessionAdapter | null = null;

export function configureAuthSession(adapter: AuthSessionAdapter) {
  sessionAdapter = adapter;
}

export function getAuthSessionAdapter() {
  return sessionAdapter;
}
