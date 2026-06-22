import { test, expect } from "@playwright/test";
import { storageFileFor } from "./fixtures/roles";

/**
 * Moderationsbereich (Rolle MODERATOR oder MANAGER).
 */
test.describe("Moderation", () => {
  test("Moderator sieht den Moderationsbereich", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: storageFileFor("moderator") });
    const page = await ctx.newPage();

    await page.goto("/moderation");
    await expect(page.getByRole("heading", { name: "Moderation", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Offene Meldungen" })).toBeVisible();

    await ctx.close();
  });

  test("Nutzer ohne Rechte werden vom Moderationsbereich weggeleitet", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: storageFileFor("anfrager") });
    const page = await ctx.newPage();

    await page.goto("/moderation");
    // Route ist für NUTZER nicht registriert → Redirect auf die Startseite.
    await expect(page).toHaveURL(/localhost:3000\/$/);
    await expect(page.getByRole("heading", { name: "Moderation", level: 1 })).toHaveCount(0);

    await ctx.close();
  });
});
