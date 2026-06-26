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
 * Komponenten-Checks der Vitest-Suite. Geprüft wird gegen WCAG 2.0/2.1/2.2,
 * Level A und AA – inklusive Farbkontrast.
 */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// Animationen/Transitions vor dem Scan abschalten, damit der Endzustand
// gemessen wird. Sonst sampelt axe ggf. mitten in der Karten-Einblendung
// (Opacity < 1), wo der Farbkontrast kurzzeitig einbricht.
const FREEZE_ANIMATIONS =
  "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important;}";

const scan = async (page: Page) => {
  await page.addStyleTag({ content: FREEZE_ANIMATIONS });
  return new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
};

test.describe("Accessibility (axe, ganze Seiten)", () => {
  // Wir scannen mit `prefers-reduced-motion: reduce` – so, wie es Nutzer mit
  // aktivierter Systemeinstellung sehen. Das übt zugleich den Reduced-Motion-
  // Pfad der App und macht den Scan unabhängig von laufenden Einblende-
  // Animationen stabil.
  test.use({ reducedMotion: "reduce" });

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

    const ctx = await browser.newContext({
      storageState: storageFileFor("anfrager"),
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    await page.goto(`/tools/${tool.id}`);
    await expect(page.getByRole("heading", { name: "Werkzeug buchen" })).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);
    await ctx.close();
  });

  test("Inbox (eingeloggt) ist barrierefrei", async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: storageFileFor("anfrager"),
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    await page.goto("/inbox");
    expect((await scan(page)).violations).toEqual([]);
    await ctx.close();
  });
});
