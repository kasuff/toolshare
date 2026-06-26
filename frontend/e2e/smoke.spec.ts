import { test, expect } from "@playwright/test";
import { readUsers } from "./fixtures/roles";

/**
 * Phase 1 – Smoke & Setup.
 * Diese Tests laufen auch im Mobile-Projekt (Tag @smoke) und sichern ab, dass
 * Frontend, Backend und Session grundsätzlich zusammenspielen.
 */
test.describe("Smoke", () => {
  test("Startseite lädt @smoke", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/ToolShare/);
    // Das Logo ist auf jedem Viewport sichtbar (Mobile-Nav ist eingeklappt).
    await expect(page.getByRole("link", { name: "ToolShare" })).toBeVisible();
  });

  test("Werkzeugliste lädt als Gast @smoke", async ({ page }) => {
    await page.goto("/tools");
    await expect(page.getByRole("heading", { level: 1, name: "Werkzeuge" })).toBeVisible();
    await expect(page.getByText("Bitte anmelden")).toBeVisible();
  });

  test("Gast wird bei geschützter Aktion zum Login geleitet @smoke", async ({ page }) => {
    await page.goto("/tools/new");
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByRole("heading", { name: "Willkommen zurück" })).toBeVisible();
  });

  test("Login über die UI funktioniert @smoke", async ({ page }) => {
    const { anfrager } = readUsers();

    await page.goto("/auth");
    await page.getByPlaceholder("E-Mail").fill(anfrager.email);
    await page.getByPlaceholder("Passwort (mind. 8 Zeichen)").fill(anfrager.password);
    await page.getByRole("button", { name: "Einloggen" }).click();

    // Nach erfolgreichem Login leitet /auth auf die Startseite um.
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("link", { name: /Nachrichten/ })).toBeVisible();
  });

  test("Mobile-Navigation öffnet und schließt @smoke", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("mobile"), "nur auf Mobile-Viewport relevant");

    await page.goto("/");
    const toggle = page.locator('button[aria-controls="primary-navigation"]');

    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    // Auf die Navigation selbst scopen (Dashboard hat ebenfalls "Werkzeuge"-Kachel).
    await expect(
      page.locator("#primary-navigation").getByRole("link", { name: "Werkzeuge", exact: true }),
    ).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
