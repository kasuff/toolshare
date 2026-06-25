import { test, expect } from "@playwright/test";
import { openInboxThread, seedTool, submitToolRequest } from "./fixtures/booking";
import { storageFileFor } from "./fixtures/roles";

/**
 * Kurzflow Moderation: Meldung aus der Inbox anlegen, im Moderationsbereich prüfen und verwerfen.
 */
test.describe("Moderation – Meldung bearbeiten", () => {
  test("Nutzer meldet Gegenpartei, Moderator verwirft die Meldung", async ({ browser }) => {
    const tool = await seedTool("E2E Meldung");

    await test.step("Anfrager stellt eine Anfrage (Kontext für die Meldung)", async () => {
      const anfragerCtx = await browser.newContext({ storageState: storageFileFor("anfrager") });
      const anfrager = await anfragerCtx.newPage();
      await submitToolRequest(anfrager, tool.id);
      await anfragerCtx.close();
    });

    await test.step("Anfrager meldet den Anbieter aus dem Chat", async () => {
      const anfragerCtx = await browser.newContext({ storageState: storageFileFor("anfrager") });
      const anfrager = await anfragerCtx.newPage();
      await openInboxThread(anfrager, tool.name);

      await anfrager.getByRole("button", { name: "Konversationsaktionen" }).click();
      await anfrager.getByRole("menuitem", { name: "Nutzer melden" }).click();

      const dialog = anfrager.getByRole("dialog");
      await dialog.getByPlaceholder("z. B. unpassende Inhalte oder Verhalten").fill("Unhöfliche Nachrichten");
      await dialog.getByPlaceholder("Weitere Hinweise für die Moderation").fill("Mehrfach beleidigend");
      await dialog.getByRole("button", { name: "Nutzer melden" }).click();

      await expect(anfrager.locator(".toast-popup")).toContainText(
        "Nutzer wurde gemeldet. Der Chatverlauf wurde als Kontext übermittelt.",
      );
      await anfragerCtx.close();
    });

    await test.step("Moderator verwirft die Meldung", async () => {
      const moderatorCtx = await browser.newContext({ storageState: storageFileFor("moderator") });
      const moderator = await moderatorCtx.newPage();
      await moderator.goto("/moderation");

      await expect(moderator.getByText("Mehrfach beleidigend")).toBeVisible();
      await moderator.getByPlaceholder("Begründung beim Verwerfen (Pflicht)").fill("Kein Verstoß erkennbar");
      await moderator.getByRole("button", { name: "Verwerfen" }).click();

      await expect(moderator.getByText("Keine offenen Meldungen")).toBeVisible();
      await moderatorCtx.close();
    });
  });
});
