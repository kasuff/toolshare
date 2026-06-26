import { test, expect } from "@playwright/test";
import { readUsers, storageFileFor } from "./fixtures/roles";
import { makeUser } from "./fixtures/data";

/**
 * Phase 1 – Authentifizierungs-Flows über die UI.
 */
test.describe("Authentifizierung", () => {
  test("Login mit falschem Passwort zeigt eine Fehlermeldung", async ({ page }) => {
    const { anfrager } = readUsers();

    await page.goto("/auth");
    await page.getByPlaceholder("E-Mail").fill(anfrager.email);
    await page.getByPlaceholder("Passwort (mind. 8 Zeichen)").fill("falsch-falsch-1");
    await page.getByRole("button", { name: "Einloggen" }).click();

    await expect(page.locator(".toast-popup")).toContainText(
      "E-Mail oder Passwort ist nicht korrekt.",
    );
    await expect(page).toHaveURL(/\/auth/);
  });

  test("Registrierung über die UI legt ein Konto an und loggt ein", async ({ page }) => {
    const user = makeUser("ui-register");

    // Adressvalidierung deterministisch machen (sonst externer Provider).
    await page.route("**/api/address/validate**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          isValid: true,
          normalizedAddress: user.address,
          normalizedParts: null,
        }),
      });
    });

    await page.goto("/auth");
    await page.getByRole("button", { name: /Jetzt registrieren/ }).click();

    await page.getByPlaceholder("Name").fill(user.name);
    await page.getByPlaceholder("E-Mail").fill(user.email);

    // Adresse manuell eingeben (umgeht die Autocomplete-Vorschläge).
    await page.getByRole("button", { name: "Adresse manuell eingeben" }).click();
    await page.getByPlaceholder("Straße").fill("Teststraße");
    await page.getByPlaceholder("Hausnr.").fill("12");
    await page.getByPlaceholder("PLZ").fill("80331");
    // "Ort" exakt matchen – sonst greift es auch "Passwort"-Felder.
    await page.getByPlaceholder("Ort", { exact: true }).fill("München");

    await page.getByPlaceholder("Passwort (mind. 8 Zeichen)").fill(user.password);
    await page.getByPlaceholder("Passwort wiederholen").fill(user.password);

    await page.getByRole("button", { name: "Registrieren und starten" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("link", { name: /Nachrichten/ })).toBeVisible();
  });

  test.describe("eingeloggt", () => {
    test.use({ storageState: storageFileFor("anfrager") });

    test("Logout beendet die Session", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("link", { name: /Nachrichten/ }).waitFor();

      // Profilmenü öffnen und ausloggen.
      await page.locator("details.profile-menu > summary").click();
      await page.getByRole("button", { name: "Ausloggen" }).click();

      await expect(page.getByRole("link", { name: "Einloggen" })).toBeVisible();
    });
  });
});
