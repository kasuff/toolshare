import { test, expect } from "@playwright/test";
import { openInboxThread, seedTool, submitToolRequest } from "./fixtures/booking";
import { futureDate } from "./fixtures/data";
import { storageFileFor } from "./fixtures/roles";

/**
 * Kernflow „Alternativvorschlag": Anbieter schlägt andere Abhol-/Rückgabezeiten vor,
 * Anfrager nimmt den Vorschlag an.
 */
test.describe("Ausleihe – Alternativvorschlag", () => {
  test("Anbieter schlägt Zeiten vor, Anfrager nimmt an", async ({ browser }) => {
    const tool = await seedTool("E2E Gegenvorschlag");
    const altPickup = futureDate(4);
    const altReturn = futureDate(6);

    await test.step("Anfrager stellt eine Ausleihanfrage", async () => {
      const anfragerCtx = await browser.newContext({ storageState: storageFileFor("anfrager") });
      const anfrager = await anfragerCtx.newPage();
      await submitToolRequest(anfrager, tool.id);
      await anfragerCtx.close();
    });

    await test.step("Anbieter sendet einen Alternativvorschlag", async () => {
      const anbieterCtx = await browser.newContext({ storageState: storageFileFor("anbieter") });
      const anbieter = await anbieterCtx.newPage();
      await openInboxThread(anbieter, tool.name);

      await anbieter.getByRole("button", { name: "Alternativvorschlag senden" }).click();
      await anbieter.getByLabel("Alternatives Abholdatum").fill(altPickup.display);
      await anbieter.getByLabel("Alternative Abholzeit").fill("12:00");
      await anbieter.getByLabel("Alternatives Rückgabedatum").fill(altReturn.display);
      await anbieter.getByLabel("Alternative Rückgabezeit").fill("14:00");
      await anbieter.getByRole("button", { name: "Alternativvorschlag senden", exact: true }).click();

      await expect(anbieter.getByText("Alternativvorschlag · Warte auf Antwort")).toBeVisible();
      await anbieterCtx.close();
    });

    await test.step("Anfrager nimmt den Vorschlag an", async () => {
      const anfragerCtx = await browser.newContext({ storageState: storageFileFor("anfrager") });
      const anfrager = await anfragerCtx.newPage();
      await openInboxThread(anfrager, tool.name);

      await anfrager.getByRole("button", { name: "Annehmen" }).click();
      await expect(anfrager.locator(".toast-popup")).toContainText("Alternativvorschlag angenommen.");
      await anfragerCtx.close();
    });
  });
});
