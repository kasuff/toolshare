import { test, expect, request as apiRequest, type APIRequestContext } from "@playwright/test";
import { createTool } from "./fixtures/api";
import { uniqueSuffix } from "./fixtures/data";
import { readUsers, storageFileFor } from "./fixtures/roles";

/**
 * Phase 3 – Network-Mocking / Resilienz.
 *
 * Mit `page.route` lassen sich Backend-Antworten gezielt manipulieren, ohne den
 * Server anzufassen. Hier erzwingen wir einen Server-Fehler beim Laden eines
 * Werkzeugs und prüfen, dass die UI den Fehler sichtbar macht und sauber
 * zurückleitet, statt hängen zu bleiben.
 */
test.describe("Network-Mocking – Fehlerbehandlung", () => {
  test("Server-Fehler beim Laden eines Werkzeugs wird angezeigt", async ({ browser }) => {
    const users = readUsers();
    const api: APIRequestContext = await apiRequest.newContext();
    const tool = await createTool(api, users.anbieter.token, { name: `E2E Netz ${uniqueSuffix()}` });
    await api.dispose();

    const ctx = await browser.newContext({ storageState: storageFileFor("anfrager") });
    const page = await ctx.newPage();

    // Die Detailseite lädt die Werkzeugliste (`GET /api/tools`) und filtert
    // clientseitig. Wir killen daher den Listen-Endpunkt – per Regex, damit
    // Sub-Ressourcen wie `/api/tools/:id/blocking-periods` unberührt bleiben.
    await page.route(/\/api\/tools(\?|$)/, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Backend nicht erreichbar (E2E-Mock)." }),
      });
    });

    await page.goto(`/tools/${tool.id}`);

    // Die Detailseite fängt den Server-Fehler ab, zeigt einen generischen
    // Fehler-Toast und leitet zur Übersicht zurück (statt hängen zu bleiben).
    await expect(
      page.getByText("Werkzeug konnte nicht geladen werden.").first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/tools$/);

    await ctx.close();
  });
});
