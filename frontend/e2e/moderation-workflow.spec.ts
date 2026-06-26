import { test, expect, request as apiRequest } from "@playwright/test";
import { openInboxThread, seedTool, submitToolRequest } from "./fixtures/booking";
import { listNotifications } from "./fixtures/api";
import { storageFileFor, readUsers } from "./fixtures/roles";

/**
 * Kurzflow Moderation: Meldung aus der Inbox anlegen, im Moderationsbereich prüfen und verwerfen.
 */
test.describe.configure({ mode: "serial" });

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
      const report = moderator.locator("li.moderation-report").filter({ hasText: "Mehrfach beleidigend" });
      await report.getByPlaceholder("Begründung beim Verwerfen (Pflicht)").fill("Kein Verstoß erkennbar");
      await report.getByRole("button", { name: "Verwerfen" }).click();

      await expect(moderator.getByText("Keine offenen Meldungen")).toBeVisible();
      await moderatorCtx.close();
    });
  });

  test("Nutzer meldet Gegenpartei, Moderator ermahnt den Anbieter", async ({ browser }) => {
    test.setTimeout(60_000);
    const tool = await seedTool("E2E Ermahnung");
    const { anbieter: provider } = readUsers();

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
      await dialog.getByPlaceholder("Weitere Hinweise für die Moderation").fill("E2E Ermahnungstest");
      await dialog.getByRole("button", { name: "Nutzer melden" }).click();

      await expect(anfrager.locator(".toast-popup")).toContainText("Nutzer wurde gemeldet.");
      await anfragerCtx.close();
    });

    await test.step("Moderator ermahnt den gemeldeten Nutzer", async () => {
      const moderatorCtx = await browser.newContext({ storageState: storageFileFor("moderator") });
      const moderator = await moderatorCtx.newPage();
      await moderator.goto("/moderation");

      await expect(moderator.getByText("E2E Ermahnungstest")).toBeVisible();
      const report = moderator.locator("li.moderation-report").filter({ hasText: "E2E Ermahnungstest" });
      await report.getByRole("button", { name: "Nutzer ermahnen" }).click();

      const dialog = moderator.getByRole("dialog");
      await dialog.getByPlaceholder("Was ist passiert und warum ist diese Maßnahme angemessen?").fill("Bitte respektvoll bleiben");
      await dialog.getByRole("button", { name: "Ermahnung senden" }).click();

      await expect(moderator.getByText("Keine offenen Meldungen")).toBeVisible();
      await moderatorCtx.close();
    });

    await test.step("Anbieter sieht die Ermahnung in der Inbox", async () => {
      await expect
        .poll(
          async () => {
            const api = await apiRequest.newContext();
            const notifications = await listNotifications(api, provider.token);
            await api.dispose();
            return notifications.some(
              (notification) =>
                notification.message.startsWith("ERMAHNUNG:") &&
                notification.message.includes("Bitte respektvoll bleiben"),
            );
          },
          { timeout: 45_000 },
        )
        .toBe(true);

      const anbieterCtx = await browser.newContext({ storageState: storageFileFor("anbieter") });
      const anbieter = await anbieterCtx.newPage();
      await anbieter.goto("/inbox");

      const warningThread = anbieter.locator(".messenger-thread-item", { hasText: "Ermahnung der Moderation" });
      await expect(warningThread.first()).toBeVisible();
      await warningThread.first().click();
      await expect(anbieter.getByText("Grund der Ermahnung:")).toBeVisible();
      await expect(anbieter.getByRole("blockquote")).toContainText("Bitte respektvoll bleiben");
      await anbieterCtx.close();
    });
  });
});
