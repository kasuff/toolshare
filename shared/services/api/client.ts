import { beginRequestActivity } from "../requestActivity";
import { notifySessionExpired, SESSION_EXPIRED_MESSAGE } from "../sessionEvents";

let API_BASE = "http://localhost:4000/api";

export function setApiBaseUrl(url: string) {
  API_BASE = url;
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

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const finishActivity = beginRequestActivity();
  try {
    let response: Response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init?.headers ?? {})
        }
      });
    } catch {
      throw new Error("Netzwerkfehler: Bitte Verbindung prüfen und erneut versuchen.");
    }

    if (response.status === 401 && token) {
      notifySessionExpired();
      throw new Error(SESSION_EXPIRED_MESSAGE);
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

export { request, translateValidationMessage, toLocalDateTimeInputValue };
