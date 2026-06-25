import { test, expect } from "@playwright/test";
import {
  acceptBookingAsProvider,
  completeBookingAsProvider,
  openInboxThread,
  seedTool,
  submitToolRequest,
} from "./fixtures/booking";
import { storageFileFor } from "./fixtures/roles";

/**
 * Kernflow „Bewertung": Nach Abschluss kann der Anfrager eine Bewertung abgeben.
 */
test.describe("Ausleihe – Bewertung", () => {
  test("Anfrager bewertet eine abgeschlossene Buchung", async ({ browser }) => {
    const tool = await seedTool("E2E Bewertung");

    await test.step("Anfrage stellen, annehmen und abschließen", async () => {
      const anfragerCtx = await browser.newContext({ storageState: storageFileFor("anfrager") });
      const anfrager = await anfragerCtx.newPage();
      await submitToolRequest(anfrager, tool.id);
      await anfragerCtx.close();

      await acceptBookingAsProvider(browser, tool.name);
      await completeBookingAsProvider(browser, tool.name);
    });

    await test.step("Anfrager gibt eine Bewertung ab", async () => {
      const anfragerCtx = await browser.newContext({ storageState: storageFileFor("anfrager") });
      const anfrager = await anfragerCtx.newPage();
      await openInboxThread(anfrager, tool.name);

      await anfrager.getByRole("button", { name: "Bewertung abgeben" }).click();
      await anfrager.getByRole("button", { name: "4 von 5 Sternen" }).click();
      await anfrager.getByLabel("Kommentar (optional)").fill("Sehr zuverlässig");
      await anfrager.getByRole("button", { name: "Bewertung speichern" }).click();

      await expect(anfrager.locator(".toast-popup")).toContainText("Bewertung gespeichert.");
      await expect(anfrager.getByText("Bewertung", { exact: true })).toBeVisible();
      await expect(anfrager.getByText("Sehr zuverlässig")).toBeVisible();
      await anfragerCtx.close();
    });
  });
});
