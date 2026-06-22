import type { Page } from "@playwright/test";
import { TEST_ADDRESS } from "./data";

/**
 * Form-Helfer für UI-getriebene Anlege-/Bearbeiten-Flows.
 *
 * Die Adressvalidierung läuft im Backend gegen einen externen Provider – im
 * E2E-Test machen wir sie deterministisch und sparen uns echte Netz-Calls.
 */

/** Minimales 1×1-PNG – als Daten-URL und als Buffer für Foto-Uploads. */
export const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
export const PNG_BUFFER = Buffer.from(PNG_DATA_URL.split(",")[1], "base64");

/** Liefert für jede Adressanfrage eine gültige, vollständige Adresse zurück. */
export async function mockAddressValidation(page: Page): Promise<void> {
  await page.route("**/api/address/validate**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        isValid: true,
        normalizedAddress: TEST_ADDRESS,
        normalizedParts: {
          street: "Teststraße",
          houseNumber: "12",
          postalCode: "80331",
          city: "München",
          country: "Deutschland",
        },
      }),
    });
  });
}

/** Adresse über die manuelle Eingabe ausfüllen (umgeht das Autocomplete). */
export async function fillAddressManually(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Adresse manuell eingeben" }).click();
  await page.getByPlaceholder("Straße").fill("Teststraße");
  await page.getByPlaceholder("Hausnummer").fill("12");
  await page.getByPlaceholder("PLZ").fill("80331");
  // "Ort" exakt matchen, sonst greift es auch andere Felder.
  await page.getByPlaceholder("Ort", { exact: true }).fill("München");
}
