import { test, expect } from "@playwright/test";
import { openInboxThread, seedTool, submitToolRequest } from "./fixtures/booking";
import { storageFileFor } from "./fixtures/roles";

/**
 * Kernflow „Abschluss": Nach Annahme markiert der Anbieter die Buchung als abgeschlossen.
 */
test.describe("Ausleihe – Buchung abschließen", () => {
  test("Anbieter schließt eine bestätigte Buchung ab", async ({ browser }) => {
    const tool = await seedTool("E2E Abschluss");

    await test.step("Anfrager stellt eine Ausleihanfrage", async () => {
      const anfragerCtx = await browser.newContext({ storageState: storageFileFor("anfrager") });
      const anfrager = await anfragerCtx.newPage();
      await submitToolRequest(anfrager, tool.id);
      await anfragerCtx.close();
    });

    await test.step("Anbieter akzeptiert die Anfrage", async () => {
      const anbieterCtx = await browser.newContext({ storageState: storageFileFor("anbieter") });
      const anbieter = await anbieterCtx.newPage();
      await openInboxThread(anbieter, tool.name);
      await anbieter.getByRole("button", { name: "Akzeptieren" }).click();
      await expect(anbieter.getByText("Anfrage angenommen")).toBeVisible();
      await anbieterCtx.close();
    });

    await test.step("Anbieter markiert die Buchung als abgeschlossen", async () => {
      const anbieterCtx = await browser.newContext({ storageState: storageFileFor("anbieter") });
      const anbieter = await anbieterCtx.newPage();
      await openInboxThread(anbieter, tool.name);

      await anbieter.getByRole("button", { name: "Als abgeschlossen markieren" }).click();
      await expect(anbieter.locator(".toast-popup")).toContainText("Buchung als abgeschlossen markiert.");
      await expect(anbieter.getByText("Buchung abgeschlossen")).toBeVisible();
      await anbieterCtx.close();
    });
  });
});
