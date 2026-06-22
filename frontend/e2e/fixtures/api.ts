import { APIRequestContext, expect } from "@playwright/test";
import { TEST_ADDRESS, uniqueSuffix, type NewUser } from "./data";

/**
 * Dünne API-Helfer für das Test-Setup. Sie sprechen das Backend direkt an
 * (kein Browser, kein CORS), um Testdaten schnell und ohne UI vorzubereiten.
 */

export const API_URL = process.env.E2E_API_URL ?? "http://localhost:4000/api";
export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/** localStorage-Schlüssel, unter dem das Frontend den Access-Token ablegt. */
export const TOKEN_STORAGE_KEY = "toolshare_access_token";

export type AuthPayload = {
  user: { id: string; email: string; name: string; role: string };
  accessToken: string;
  refreshToken: string;
};

export type CreatedTool = {
  id: string;
  name: string;
  description: string;
  category: string;
  ownerId: string;
  status: string;
};

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function registerUser(
  request: APIRequestContext,
  user: NewUser,
): Promise<AuthPayload> {
  const res = await request.post(`${API_URL}/auth/register`, {
    data: {
      email: user.email,
      password: user.password,
      name: user.name,
      address: user.address,
    },
  });
  expect(res.ok(), `register fehlgeschlagen: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

export async function loginUser(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<AuthPayload> {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });
  expect(res.ok(), `login fehlgeschlagen: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

export async function createTool(
  request: APIRequestContext,
  token: string,
  overrides: Partial<{
    name: string;
    description: string;
    category: string;
    pickupLocation: string;
    pickupLocationNote: string;
    imageUrl: string;
  }> = {},
): Promise<CreatedTool> {
  const suffix = uniqueSuffix();
  const body = {
    name: overrides.name ?? `E2E Akkuschrauber ${suffix}`,
    description:
      overrides.description ?? "E2E-Testwerkzeug für automatisierte Browser-Tests.",
    category: overrides.category ?? "elektro",
    pickupLocation: overrides.pickupLocation ?? TEST_ADDRESS,
    ...(overrides.pickupLocationNote ? { pickupLocationNote: overrides.pickupLocationNote } : {}),
    ...(overrides.imageUrl ? { imageUrl: overrides.imageUrl } : {}),
  };
  const res = await request.post(`${API_URL}/tools`, {
    headers: authHeaders(token),
    data: body,
  });
  expect(res.ok(), `createTool fehlgeschlagen: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

export type BackendRole = "USER" | "MODERATOR" | "MANAGER";

/** Setzt die Rolle eines Nutzers (nur mit Manager-Token erlaubt). */
export async function setUserRole(
  request: APIRequestContext,
  managerToken: string,
  userId: string,
  role: BackendRole,
): Promise<void> {
  const res = await request.patch(`${API_URL}/users/${userId}/role`, {
    headers: authHeaders(managerToken),
    data: { role },
  });
  expect(res.ok(), `setUserRole fehlgeschlagen: ${res.status()} ${await res.text()}`).toBeTruthy();
}

export type CreatedWorkshop = {
  id: string;
  name: string;
  location: string;
  maxCapacity: number;
  ownerId: string;
};

export async function createWorkshop(
  request: APIRequestContext,
  token: string,
  overrides: Partial<{ name: string; maxCapacity: number; location: string; imageUrls: string[] }> = {},
): Promise<CreatedWorkshop> {
  const suffix = uniqueSuffix();
  const res = await request.post(`${API_URL}/workshops`, {
    headers: authHeaders(token),
    data: {
      name: overrides.name ?? `E2E Werkstatt ${suffix}`,
      description: "E2E-Testwerkstatt für automatisierte Browser-Tests.",
      location: overrides.location ?? TEST_ADDRESS,
      maxCapacity: overrides.maxCapacity ?? 1,
      extras: [],
      workshopTools: [],
      imageUrls: overrides.imageUrls ?? [],
    },
  });
  expect(res.ok(), `createWorkshop fehlgeschlagen: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

/** Blockiert einen Zeitraum als Eigentümer (macht ihn für Buchungen unverfügbar). */
export async function blockWorkshopSlot(
  request: APIRequestContext,
  token: string,
  workshopId: string,
  startIso: string,
  endIso: string,
): Promise<void> {
  const res = await request.post(`${API_URL}/workshops/${workshopId}/timeslots`, {
    headers: authHeaders(token),
    data: {
      startTime: new Date(startIso).toISOString(),
      endTime: new Date(endIso).toISOString(),
      blockedByOwner: true,
    },
  });
  expect(res.ok(), `blockWorkshopSlot fehlgeschlagen: ${res.status()} ${await res.text()}`).toBeTruthy();
}

/**
 * Baut ein Playwright-`storageState`-Objekt, das den Access-Token für die
 * Frontend-Origin in den localStorage legt. So sind Tests sofort eingeloggt,
 * ohne den UI-Login durchlaufen zu müssen.
 */
export function storageStateForToken(token: string) {
  return {
    cookies: [],
    origins: [
      {
        origin: BASE_URL,
        localStorage: [{ name: TOKEN_STORAGE_KEY, value: token }],
      },
    ],
  };
}
