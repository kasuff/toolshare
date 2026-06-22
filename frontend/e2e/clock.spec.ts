import { test, expect, request as apiRequest, type APIRequestContext } from "@playwright/test";
import { createTool } from "./fixtures/api";
import { uniqueSuffix } from "./fixtures/data";
import { readUsers, storageFileFor } from "./fixtures/roles";

/**
 * Phase 3 – Clock-Mocking.
 *
 * Die Buchungs-Detailseite schlägt als Standard "morgen" bis "übermorgen" vor
 * (`getDefaultDates`, basiert auf `new Date()`). Mit einer fixierten Systemzeit
 * wird dieses Verhalten deterministisch testbar – unabhängig davon, wann die
 * Suite läuft.
 */
test.describe("Clock-Mocking – zeitabhängige Defaults", () => {
  test("Default-Buchungszeitraum folgt der gemockten Systemzeit", async ({ browser }) => {
    const users = readUsers();
    const api: APIRequestContext = await apiRequest.newContext();
    const tool = await createTool(api, users.anbieter.token, { name: `E2E Clock ${uniqueSuffix()}` });
    await api.dispose();

    const ctx = await browser.newContext({ storageState: storageFileFor("anfrager") });
    const page = await ctx.newPage();

    // Zeit einfrieren, bevor die App lädt: 15.06.2026, 10:00 (lokale Zeit).
    await page.clock.setFixedTime(new Date("2026-06-15T10:00:00"));
    await page.goto(`/tools/${tool.id}`);

    // getDefaultDates(): Start = heute + 1 Tag, Ende = Start + 1 Tag.
    await expect(page.getByLabel("Abholdatum")).toHaveValue("16.06.2026");
    await expect(page.getByLabel("Abgabedatum")).toHaveValue("17.06.2026");

    await ctx.close();
  });
});
