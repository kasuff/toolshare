import { test, expect } from "@playwright/test";
import { storageFileFor } from "./fixtures/roles";
import { uniqueSuffix } from "./fixtures/data";
import { PNG_BUFFER, fillAddressManually, mockAddressValidation } from "./fixtures/forms";

/**
 * Anlegen von Angeboten über die UI (Anbieter-Session).
 *
 * Ergänzt die bestehenden Specs, die Werkzeuge/Werkstätten bisher nur per API
 * angelegt haben – hier wird der echte Formular-Flow im Browser geprüft.
 */
test.describe("Angebote anlegen (UI)", () => {
  test.use({ storageState: storageFileFor("anbieter") });

  test("Werkzeug über die UI einstellen", async ({ page }) => {
    await mockAddressValidation(page);
    const name = `E2E UI Werkzeug ${uniqueSuffix()}`;

    await page.goto("/tools/new");
    await page.getByPlaceholder("z.B. Akku-Bohrmaschine").fill(name);
    await page.getByPlaceholder(/Zustand: wie neu/).fill("Sehr guter Zustand, komplett mit Zubehör.");
    await page.getByLabel(/Kategorie/).selectOption("elektro");
    await fillAddressManually(page);

    await page.getByRole("button", { name: "Werkzeug einstellen" }).click();

    await expect(page.locator(".toast-popup")).toContainText("Werkzeug erfolgreich eingestellt!");
    await expect(page).toHaveURL(/\/tools$/);
  });

  test("Werkstatt über die UI einstellen", async ({ page }) => {
    await mockAddressValidation(page);
    const name = `E2E UI Werkstatt ${uniqueSuffix()}`;

    await page.goto("/workshops/new");

    // Mindestens ein Foto ist Pflicht. Der Datei-Input ist visuell versteckt,
    // `setInputFiles` kann ihn trotzdem direkt befüllen.
    await page.locator('input[type="file"]').setInputFiles({
      name: "werkstatt.png",
      mimeType: "image/png",
      buffer: PNG_BUFFER,
    });
    await expect(page.getByText("1 von 3 Fotos")).toBeVisible();

    await page.getByPlaceholder("z.B. Garagen-Werkstatt").fill(name);
    await page.getByPlaceholder(/helle Werkstatt/).fill("Geräumige Werkstatt mit guter Ausstattung.");
    await fillAddressManually(page);

    await page.getByRole("button", { name: "Werkstatt einstellen" }).click();

    await expect(page.locator(".toast-popup")).toContainText("Werkstatt erfolgreich eingestellt!");
    await expect(page).toHaveURL(/\/workshops$/);
  });
});
