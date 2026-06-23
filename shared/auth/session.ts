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
};

let sessionAdapter: AuthSessionAdapter | null = null;

export function configureAuthSession(adapter: AuthSessionAdapter) {
  sessionAdapter = adapter;
}

export function getAuthSessionAdapter() {
  return sessionAdapter;
}
