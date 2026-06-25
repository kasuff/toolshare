import { test, expect } from "@playwright/test";
import { seedTool, submitToolRequest } from "./fixtures/booking";
import { readUsers, storageFileFor } from "./fixtures/roles";

/**
 * Glocke und Thread-Unread: neue Anfrage erscheint als ungelesene Konversation.
 */
test.describe("Benachrichtigungen – Glocke", () => {
  test("Anbieter sieht neue Anfrage an der Glocke und im Thread", async ({ browser }) => {
    const tool = await seedTool("E2E Glocke");
    const { anbieter: provider } = readUsers();

    await test.step("Anfrager stellt eine Ausleihanfrage", async () => {
      const anfragerCtx = await browser.newContext({ storageState: storageFileFor("anfrager") });
      const anfrager = await anfragerCtx.newPage();
      await submitToolRequest(anfrager, tool.id);
      await anfragerCtx.close();
    });

    await test.step("Anbieter sieht Glocke und ungelesenen Thread", async () => {
      const anbieterCtx = await browser.newContext({ storageState: storageFileFor("anbieter") });
      await anbieterCtx.addInitScript((userId) => {
        localStorage.setItem(`toolshare.inbox.readSeed.v1.${userId}`, "1");
      }, provider.id);
      const anbieter = await anbieterCtx.newPage();
      await anbieter.goto("/");

      await expect(anbieter.locator(".notification-bell-badge")).toBeVisible();
      await expect(anbieter.getByRole("link", { name: /ungelesene Konversationen/ })).toBeVisible();

      await anbieter.getByRole("link", { name: /Nachrichten und Benachrichtigungen/ }).click();
      const thread = anbieter.locator(".messenger-thread-item", { hasText: tool.name });
      await expect(thread).toHaveClass(/messenger-thread-item--unread/);

      await thread.click();
      await expect(thread).not.toHaveClass(/messenger-thread-item--unread/);
      await anbieterCtx.close();
    });
  });
});
