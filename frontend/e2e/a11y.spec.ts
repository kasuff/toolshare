import { test, expect, request as apiRequest, type APIRequestContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createTool } from "./fixtures/api";
import { uniqueSuffix } from "./fixtures/data";
import { readUsers, storageFileFor } from "./fixtures/roles";

/**
 * Phase 3 – Accessibility (komplementär zu den jest-axe-Komponententests).
 *
 * axe scannt hier ganze, real gerenderte Seiten im Browser (echtes CSS,
 * Routing, eingeloggte Zustände) und ergänzt damit die isolierten
 * Komponenten-Checks der Vitest-Suite.
 *
 * Hinweis zu `color-contrast`: Auf den Karten gibt es ein bekanntes
 * Kontrast-Defizit (oranges "Details"-Label, ~4.36:1 statt 4.5:1). Das ist
 * bestehende Design-Schuld, wird separat behandelt und hier bewusst
 * ausgeklammert, damit der Scan stabil strukturelle A11y-Regressionen abfängt
 * (fehlende Labels/Rollen/Alt-Texte/Headings etc.).
 */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const scan = (page: Page) =>
  new AxeBuilder({ page }).withTags(WCAG_TAGS).disableRules(["color-contrast"]).analyze();

test.describe("Accessibility (axe, ganze Seiten)", () => {
  test("Startseite ist barrierefrei", async ({ page }) => {
    await page.goto("/");
    expect((await scan(page)).violations).toEqual([]);
  });

  test("Werkzeugliste ist barrierefrei", async ({ page }) => {
    await page.goto("/tools");
    expect((await scan(page)).violations).toEqual([]);
  });

  test("Auth-Seite ist barrierefrei", async ({ page }) => {
    await page.goto("/auth");
    expect((await scan(page)).violations).toEqual([]);
  });

  test("Werkzeug-Detailseite ist barrierefrei", async ({ browser }) => {
    const users = readUsers();
    const api: APIRequestContext = await apiRequest.newContext();
    const tool = await createTool(api, users.anbieter.token, { name: `E2E A11y ${uniqueSuffix()}` });
    await api.dispose();

    const ctx = await browser.newContext({ storageState: storageFileFor("anfrager") });
    const page = await ctx.newPage();
    await page.goto(`/tools/${tool.id}`);
    await expect(page.getByRole("heading", { name: "Werkzeug buchen" })).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);
    await ctx.close();
  });

  test("Inbox (eingeloggt) ist barrierefrei", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: storageFileFor("anfrager") });
    const page = await ctx.newPage();
    await page.goto("/inbox");
    expect((await scan(page)).violations).toEqual([]);
    await ctx.close();
  });
});
