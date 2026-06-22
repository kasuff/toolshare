import { test, expect, request as apiRequest, type APIRequestContext } from "@playwright/test";
import { createTool, type CreatedTool } from "./fixtures/api";
import { futureDate, uniqueSuffix } from "./fixtures/data";
import { readUsers, storageFileFor } from "./fixtures/roles";

/**
 * Phase 2 – Kernflow „Ausleihe": Ein Anfrager stellt über die UI eine
 * Werkzeuganfrage, der Anbieter entscheidet darüber in seiner Inbox.
 *
 * Beide Rollen brauchen eigene Sessions, deshalb arbeiten wir mit zwei
 * Browser-Kontexten (je ein vorbereiteter `storageState`). Jeder Test legt
 * sein eigenes, eindeutig benanntes Werkzeug an, damit parallele Läufe sich
 * nicht über denselben Inbox-Thread in die Quere kommen.
 */
test.describe("Ausleihe – Anfrage und Inbox-Entscheidung", () => {
  async function seedTool(name: string): Promise<CreatedTool> {
    const users = readUsers();
    const api: APIRequestContext = await apiRequest.newContext();
    const tool = await createTool(api, users.anbieter.token, { name });
    await api.dispose();
    return tool;
  }

  test("Anfrager sendet Anfrage, Anbieter akzeptiert sie", async ({ browser }) => {
    const tool = await seedTool(`E2E Bohrhammer ${uniqueSuffix()}`);
    const start = futureDate(3);
    const end = futureDate(5);

    await test.step("Anfrager stellt über die Detailseite eine Anfrage", async () => {
      const anfragerCtx = await browser.newContext({ storageState: storageFileFor("anfrager") });
      const anfrager = await anfragerCtx.newPage();
      await anfrager.goto(`/tools/${tool.id}`);

      await anfrager.getByLabel("Abholdatum").fill(start.display);
      await anfrager.getByLabel("Abholzeit").fill("10:00");
      await anfrager.getByLabel("Abgabedatum").fill(end.display);
      await anfrager.getByLabel("Abgabezeit").fill("16:00");

      await anfrager.getByRole("button", { name: "Anfrage senden" }).click();

      await expect(anfrager.locator(".toast-popup")).toContainText("Ausleihanfrage erstellt.");
      await expect(anfrager).toHaveURL(/\/inbox/);
      await anfragerCtx.close();
    });

    await test.step("Anbieter akzeptiert die Anfrage in der Inbox", async () => {
      const anbieterCtx = await browser.newContext({ storageState: storageFileFor("anbieter") });
      const anbieter = await anbieterCtx.newPage();
      await anbieter.goto("/inbox");

      await anbieter.locator(".messenger-thread-item", { hasText: tool.name }).first().click();
      await anbieter.getByRole("button", { name: "Akzeptieren" }).click();

      // soft: beide Folgeerwartungen werden geprüft und gemeinsam berichtet,
      // statt beim ersten Fehlschlag abzubrechen.
      await expect.soft(anbieter.getByText("Anfrage angenommen")).toBeVisible();
      // Die Aktions-Buttons verschwinden, sobald die Anfrage nicht mehr offen ist.
      await expect.soft(anbieter.getByRole("button", { name: "Akzeptieren" })).toHaveCount(0);
      await anbieterCtx.close();
    });
  });

  test("Anbieter lehnt eine Anfrage ab", async ({ browser }) => {
    const tool = await seedTool(`E2E Kreissäge ${uniqueSuffix()}`);
    const start = futureDate(7);
    const end = futureDate(9);

    const anfragerCtx = await browser.newContext({ storageState: storageFileFor("anfrager") });
    const anfrager = await anfragerCtx.newPage();
    await anfrager.goto(`/tools/${tool.id}`);
    await anfrager.getByLabel("Abholdatum").fill(start.display);
    await anfrager.getByLabel("Abholzeit").fill("09:00");
    await anfrager.getByLabel("Abgabedatum").fill(end.display);
    await anfrager.getByLabel("Abgabezeit").fill("17:00");
    await anfrager.getByRole("button", { name: "Anfrage senden" }).click();
    await expect(anfrager).toHaveURL(/\/inbox/);
    await anfragerCtx.close();

    const anbieterCtx = await browser.newContext({ storageState: storageFileFor("anbieter") });
    const anbieter = await anbieterCtx.newPage();
    await anbieter.goto("/inbox");
    await anbieter.locator(".messenger-thread-item", { hasText: tool.name }).first().click();
    await anbieter.getByRole("button", { name: "Ablehnen" }).click();

    await expect(anbieter.getByText("Anfrage abgelehnt")).toBeVisible();
    await anbieterCtx.close();
  });
});
