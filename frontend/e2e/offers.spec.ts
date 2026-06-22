import { test, expect, request as apiRequest, type APIRequestContext } from "@playwright/test";
import { createTool, registerUser, storageStateForToken } from "./fixtures/api";
import { TEST_PASSWORD, makeUser, uniqueSuffix } from "./fixtures/data";
import { mockAddressValidation } from "./fixtures/forms";

/**
 * „Meine Angebote" und Profil-Einstellungen. Für isolierte, deterministische
 * Listen/Änderungen wird je Test ein frischer Nutzer per API angelegt und seine
 * Session direkt als storageState injiziert.
 */
test.describe("Meine Angebote & Profil", () => {
  test("Meine Angebote listet das eigene Werkzeug", async ({ browser }) => {
    const api: APIRequestContext = await apiRequest.newContext();
    const user = makeUser("offers");
    const auth = await registerUser(api, user);
    const toolName = `E2E Mein Werkzeug ${uniqueSuffix()}`;
    await createTool(api, auth.accessToken, { name: toolName });
    await api.dispose();

    const ctx = await browser.newContext({ storageState: storageStateForToken(auth.accessToken) });
    const page = await ctx.newPage();
    await page.goto("/offers");

    await expect(page.getByRole("heading", { name: "Meine Angebote" })).toBeVisible();
    await expect(page.getByText(toolName)).toBeVisible();
    await ctx.close();
  });

  test("Profil speichert einen geänderten Namen", async ({ browser }) => {
    const api: APIRequestContext = await apiRequest.newContext();
    const user = makeUser("profile-name");
    const auth = await registerUser(api, user);
    await api.dispose();

    const ctx = await browser.newContext({ storageState: storageStateForToken(auth.accessToken) });
    const page = await ctx.newPage();
    await mockAddressValidation(page);
    await page.goto("/profile");

    await page.getByPlaceholder("Dein Name").fill(`${user.name} aktualisiert`);
    await page.getByRole("button", { name: "Änderungen speichern" }).click();

    await expect(page.locator(".toast-popup")).toContainText("Profil gespeichert.");
    await ctx.close();
  });

  test("Profil: Passwort ändern bestätigt den Wechsel", async ({ browser }) => {
    const api: APIRequestContext = await apiRequest.newContext();
    const user = makeUser("profile-pw");
    const auth = await registerUser(api, user);
    await api.dispose();

    const ctx = await browser.newContext({ storageState: storageStateForToken(auth.accessToken) });
    const page = await ctx.newPage();
    await page.goto("/profile");

    await page.getByRole("button", { name: "Passwort ändern" }).click();
    await page.getByPlaceholder("Aktuelles Passwort").fill(TEST_PASSWORD);
    await page.getByPlaceholder("Mindestens 8 Zeichen").fill("NeuesPasswort123!");
    await page.getByPlaceholder("Neues Passwort erneut eingeben").fill("NeuesPasswort123!");
    // Jetzt erscheint nur noch der Submit-Button mit gleichem Namen.
    await page.getByRole("button", { name: "Passwort ändern" }).click();

    await expect(page.locator(".toast-popup")).toContainText("Passwort wurde geändert.");
    await ctx.close();
  });
});
