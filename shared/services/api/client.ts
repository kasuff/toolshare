import type { z } from "zod";
import { getAuthSessionAdapter } from "../../auth/session";
import { beginRequestActivity } from "../requestActivity";
import { notifySessionExpired, SESSION_EXPIRED_MESSAGE } from "../sessionEvents";

let API_BASE = "http://localhost:4000/api";

export function setApiBaseUrl(url: string) {
  API_BASE = url;
}

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const adapter = getAuthSessionAdapter();
  if (!adapter) {
    throw new Error("No auth session configured");
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const useCookie = adapter.useCookieForRefresh === true;
    const refreshToken = useCookie ? undefined : await adapter.getRefreshToken();
    if (!useCookie && !refreshToken) {
      throw new Error("No refresh token available");
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: refreshToken ? JSON.stringify({ refreshToken }) : JSON.stringify({})
      });
    } catch {
      throw new Error("Refresh request failed");
    }

    if (!response.ok) {
      throw new Error("Refresh request failed");
    }

    const data = (await response.json()) as { accessToken: string; refreshToken: string };
    await adapter.setTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken
    });
    return data.accessToken;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

function toLocalDateTimeInputValue(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  const pad = (value: number) => `${value}`.padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function translateValidationMessage(raw: string): string {
  const minCharsMatch = raw.match(/at least (\d+) character/i);
  if (raw.includes("at least 8 character") || raw.match(/at least 8/i)) {
    return "Passwort muss mindestens 8 Zeichen lang sein.";
  }
  if (minCharsMatch) {
    return `Eingabe muss mindestens ${minCharsMatch[1]} Zeichen lang sein.`;
  }
  if (/invalid.*uuid/i.test(raw)) return "Ungültige ID.";
  if (/invalid.*email/i.test(raw)) return "Ungültige E-Mail-Adresse.";
  if (/invalid.*datetime/i.test(raw)) return "Ungültiges Datum oder Uhrzeit.";
  if (/required/i.test(raw)) return "Pflichtfeld fehlt.";
  if (/expected string/i.test(raw)) return "Text erwartet.";
  if (/expected number/i.test(raw)) return "Zahl erwartet.";
  if (/expected boolean/i.test(raw)) return "Ja/Nein-Wert erwartet.";
  if (raw.includes("Mindestens ein Feld")) return raw;
  if (raw.includes("Ungültig")) return raw;
  return raw;
}

async function handleUnauthorized<T>(
  path: string,
  init: RequestInit | undefined,
  token: string | undefined,
  isRetry: boolean
): Promise<T> {
  const adapter = getAuthSessionAdapter();

  if (!isRetry && adapter && path !== "/auth/refresh") {
    const canRefresh = adapter.useCookieForRefresh === true || Boolean(await adapter.getRefreshToken());
    if (canRefresh) {
      try {
        const newToken = await refreshAccessToken();
        return request<T>(path, init, newToken, true);
      } catch {
        // Refresh failed — fall through to session expiry
      }
    }
  }

  await adapter?.clearTokens();
  notifySessionExpired();
  throw new Error(SESSION_EXPIRED_MESSAGE);
}

async function request<T>(
  path: string,
  init?: RequestInit,
  token?: string,
  isRetry = false
): Promise<T> {
  const finishActivity = beginRequestActivity();
  const adapter = getAuthSessionAdapter();
  try {
    let response: Response;
    try {
      // Web-Clients (useCookieForRefresh=true) authentifizieren über den at-Cookie;
      // kein Bearer-Header. Mobile-Clients schicken weiterhin den Bearer-Header.
      const addBearer = Boolean(token) && adapter?.useCookieForRefresh !== true;
      response = await fetch(`${API_BASE}${path}`, {
        ...init,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(addBearer ? { Authorization: `Bearer ${token}` } : {}),
          ...(init?.headers ?? {})
        }
      });
    } catch {
      throw new Error("Netzwerkfehler: Bitte Verbindung prüfen und erneut versuchen.");
    }

    // 401-Auto-Refresh: bei explizitem Token (Mobile) oder Cookie-Auth (Web).
    // /auth/refresh selbst wird nicht erneut versucht — das würde eine Endlosschleife erzeugen.
    const isCookieAuth401 = adapter?.useCookieForRefresh === true && path !== "/auth/refresh";
    if (response.status === 401 && (token || isCookieAuth401)) {
      return handleUnauthorized<T>(path, init, token, isRetry);
    }

    if (response.status === 429) {
      throw new Error("Zu viele Anfragen. Bitte kurz warten und erneut versuchen.");
    }

    if (!response.ok) {
      let message = `Anfrage fehlgeschlagen (Fehler ${response.status}).`;
      try {
        const payload = (await response.json()) as {
          message?: string;
          detail?: string;
          code?: string;
          errors?: {
            fieldErrors?: Record<string, string[] | undefined>;
            formErrors?: string[];
          };
          error?: {
            message?: string;
            code?: string;
            details?: {
              fieldErrors?: Record<string, string[] | undefined>;
              formErrors?: string[];
            };
          };
        };
        if (payload.detail) {
          message = payload.detail;
        } else if (payload.error?.message) {
          message = payload.error.message;
        } else if (payload.message) {
          message = payload.message;
        }
        const code = payload.code ?? payload.error?.code;
        if (code === "EMAIL_ALREADY_EXISTS") {
          message = "Diese E-Mail ist bereits registriert.";
        }
        const fieldErrors = payload.errors?.fieldErrors ?? payload.error?.details?.fieldErrors;
        const formErrors = payload.errors?.formErrors ?? payload.error?.details?.formErrors;
        const fieldErrorEntries = fieldErrors
          ? Object.entries(fieldErrors).filter(([, errors]) => Boolean(errors?.length))
          : [];
        if (fieldErrorEntries.length > 0) {
          const [field, errors] = fieldErrorEntries[0];
          const rawError = errors?.[0] ?? "Ungültige Eingabe.";
          const translated = translateValidationMessage(rawError);
          message = field === "body" ? translated : `${field}: ${translated}`;
        } else if (formErrors?.length) {
          message = translateValidationMessage(formErrors[0]);
        }
      } catch {
        // keep fallback message
      }
      throw new Error(message);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } finally {
    finishActivity();
  }
}

async function requestParsed<S extends z.ZodTypeAny>(
  schema: S,
  path: string,
  init?: RequestInit,
  token?: string
): Promise<z.infer<S>> {
  const data = await request<unknown>(path, init, token);
  return schema.parse(data);
}

export { request, requestParsed, translateValidationMessage, toLocalDateTimeInputValue };
