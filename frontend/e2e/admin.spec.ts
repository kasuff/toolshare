import { test, expect, request as apiRequest, type APIRequestContext } from "@playwright/test";
import { registerUser } from "./fixtures/api";
import { makeUser } from "./fixtures/data";
import { storageFileFor } from "./fixtures/roles";

/**
 * Admin-Bereich (nur Rolle MANAGER, im Frontend als "ADMIN" gemappt).
 *
 * Damit parallele Tests nicht gestört werden, legt jeder Test einen eigenen
 * Wegwerf-Nutzer an, an dem die Manager-Aktionen ausgeführt werden – niemals an
 * den geteilten Standard-Nutzern.
 */
test.describe("Admin – Nutzerverwaltung", () => {
  test.use({ storageState: storageFileFor("manager") });

  test("Manager kann einen Nutzer zum Moderator machen und sperren", async ({ page }) => {
    const victim = makeUser("admin-ziel");
    const api: APIRequestContext = await apiRequest.newContext();
    await registerUser(api, victim);
    await api.dispose();

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin", level: 1 })).toBeVisible();

    // Nutzer suchen
    await page.getByLabel("Nutzer suchen").fill(victim.email);
    await page.getByLabel("Nutzer suchen").press("Enter");

    const promote = page.getByRole("button", { name: `${victim.name} zum Moderator machen` });
    await expect(promote).toBeVisible();

    // Zum Moderator befördern
    await promote.click();
    await expect(page.locator(".toast-popup")).toContainText("Nutzer ist jetzt Moderator.");
    await expect(
      page.getByRole("button", { name: `Moderatorrolle von ${victim.name} entfernen` }),
    ).toBeVisible();

    // Neu laden, damit der Erfolgs-Toast (dessen Overlay Klicks abfängt) weg ist
    // und die Liste den frisch beförderten Stand zeigt.
    await page.reload();
    await page.getByLabel("Nutzer suchen").fill(victim.email);
    await page.getByLabel("Nutzer suchen").press("Enter");

    // Konto sperren
    await page.getByRole("button", { name: `${victim.name} sperren` }).click();
    await expect(page.getByRole("button", { name: `${victim.name} entsperren` })).toBeVisible();
  });

  test("Nutzer ohne Rechte werden vom Admin-Bereich weggeleitet", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: storageFileFor("anfrager") });
    const page = await ctx.newPage();
    await page.goto("/admin");
    // Route ist für NUTZER nicht registriert → Redirect auf die Startseite.
    await expect(page).toHaveURL(/localhost:3000\/$/);
    await expect(page.getByRole("heading", { name: "Admin", level: 1 })).toHaveCount(0);
    await ctx.close();
  });
});
