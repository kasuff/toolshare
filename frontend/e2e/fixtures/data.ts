/**
 * Hilfsfunktionen für eindeutige Testdaten. Da es lokal keine frische
 * Test-DB pro Lauf gibt, werden alle E2E-Daten mit einem eindeutigen Suffix
 * versehen, damit parallele Läufe und Wiederholungen nicht kollidieren.
 */

export const E2E_PREFIX = "e2e";
export const TEST_PASSWORD = "Test1234!";

/**
 * Fest provisionierter Manager. Diese E-Mail steht in der
 * `MANAGER_EMAIL_ALLOWLIST` des lokalen Stacks (docker-compose) und wurde beim
 * Backend-Start einmalig zu `MANAGER` befördert. Das Setup loggt sich damit nur
 * noch per API ein (kein Neustart pro Lauf). Siehe e2e/README.md.
 */
export const MANAGER_EMAIL = process.env.E2E_MANAGER_EMAIL ?? "e2e-manager@toolshare.test";
export const MANAGER_PASSWORD = process.env.E2E_MANAGER_PASSWORD ?? "Vx7$kQp2-Mn9w-Tr4Lz8";

/** Adresse mit Hausnummer – erfüllt die Backend-Validierung (`hasHouseNumber`). */
export const TEST_ADDRESS = "Teststraße 12, 80331 München";

export function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export type NewUser = {
  label: string;
  email: string;
  password: string;
  name: string;
  address: string;
};

/**
 * Liefert ein zukünftiges Datum relativ zu heute – in ISO (für API-Calls) und
 * im Anzeigeformat `TT.MM.JJJJ`, das die `DateInput`-Komponente erwartet.
 */
export function futureDate(daysAhead: number): { iso: string; display: string } {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return { iso: `${year}-${month}-${day}`, display: `${day}.${month}.${year}` };
}

export function makeUser(label: string): NewUser {
  const suffix = uniqueSuffix();
  return {
    label,
    email: `${E2E_PREFIX}-${label}-${suffix}@example.com`,
    password: TEST_PASSWORD,
    name: `E2E ${label} ${suffix}`,
    address: TEST_ADDRESS,
  };
}
