import { test, expect, request as apiRequest, type APIRequestContext } from "@playwright/test";
import { createTool, type CreatedTool } from "./fixtures/api";
import { readUsers } from "./fixtures/roles";
import { uniqueSuffix } from "./fixtures/data";

/**
 * Phase 1/2 – Werkzeugsuche und -detail aus Gast-Sicht.
 * Die Testdaten werden per API als "anbieter" angelegt, geprüft wird im Browser.
 */
test.describe("Werkzeuge (Gast)", () => {
  let ctx: APIRequestContext;
  let tool: CreatedTool;

  test.beforeAll(async () => {
    ctx = await apiRequest.newContext();
    const { anbieter } = readUsers();
    tool = await createTool(ctx, anbieter.token, {
      name: `E2E Schlagbohrmaschine ${uniqueSuffix()}`,
    });
  });

  test.afterAll(async () => {
    await ctx.dispose();
  });

  test("Suche findet ein vorhandenes Werkzeug", async ({ page }) => {
    await page.goto("/tools");
    await page.getByPlaceholder("Name oder Beschreibung").fill(tool.name);

    await expect(page.getByText(tool.name)).toBeVisible();
  });

  test("Suche ohne Treffer zeigt den Leerzustand", async ({ page }) => {
    await page.goto("/tools");
    await page.getByPlaceholder("Name oder Beschreibung").fill(`zzz-kein-treffer-${uniqueSuffix()}`);

    await expect(page.getByText("Kein Werkzeug gefunden")).toBeVisible();
  });

  test("Detailseite bietet Gästen einen Login-Hinweis statt Buchung", async ({ page }) => {
    await page.goto(`/tools/${tool.id}`);

    await expect(page.getByRole("heading", { name: "Werkzeug buchen" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Jetzt einloggen" })).toBeVisible();
  });
});
