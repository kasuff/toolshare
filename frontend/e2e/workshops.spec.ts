import { test, expect, request as apiRequest, type APIRequestContext } from "@playwright/test";
import { blockWorkshopSlot, createWorkshop, type CreatedWorkshop } from "./fixtures/api";
import { futureDate, uniqueSuffix } from "./fixtures/data";
import { readUsers, storageFileFor } from "./fixtures/roles";

/**
 * Phase 2 – Kernflow „Werkstatt": Buchung über die UI inklusive Konfliktfall
 * (vom Anbieter blockierter Zeitraum → keine Buchung möglich).
 */
test.describe("Werkstatt – Buchung und Konflikt", () => {
  async function seedWorkshop(
    name: string,
    block?: { startIso: string; endIso: string },
  ): Promise<CreatedWorkshop> {
    const users = readUsers();
    const api: APIRequestContext = await apiRequest.newContext();
    const workshop = await createWorkshop(api, users.anbieter.token, { name, maxCapacity: 1 });
    if (block) {
      await blockWorkshopSlot(api, users.anbieter.token, workshop.id, block.startIso, block.endIso);
    }
    await api.dispose();
    return workshop;
  }

  test("Anfrager bucht einen freien Zeitraum", async ({ browser }) => {
    const workshop = await seedWorkshop(`E2E Holzwerkstatt ${uniqueSuffix()}`);
    const start = futureDate(4);
    const end = futureDate(6);

    const ctx = await browser.newContext({ storageState: storageFileFor("anfrager") });
    const page = await ctx.newPage();
    await page.goto(`/workshops/${workshop.id}`);

    await page.getByLabel("Abholdatum").fill(start.display);
    await page.getByLabel("Abholzeit").fill("09:00");
    await page.getByLabel("Abgabedatum").fill(end.display);
    await page.getByLabel("Abgabezeit").fill("12:00");

    const submit = page.getByRole("button", { name: "Anfrage senden" });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.locator(".toast-popup")).toContainText("Werkstattbuchung erstellt.");
    await expect(page).toHaveURL(/\/inbox/);
    await ctx.close();
  });

  test("Blockierter Zeitraum verhindert die Buchung", async ({ browser }) => {
    const blockStart = futureDate(10);
    const blockEnd = futureDate(12);
    const workshop = await seedWorkshop(`E2E Metallwerkstatt ${uniqueSuffix()}`, {
      startIso: `${blockStart.iso}T08:00:00`,
      endIso: `${blockEnd.iso}T18:00:00`,
    });

    const ctx = await browser.newContext({ storageState: storageFileFor("anfrager") });
    const page = await ctx.newPage();
    await page.goto(`/workshops/${workshop.id}`);

    // Genau den blockierten Zeitraum wählen.
    await page.getByLabel("Abholdatum").fill(blockStart.display);
    await page.getByLabel("Abholzeit").fill("09:00");
    await page.getByLabel("Abgabedatum").fill(blockEnd.display);
    await page.getByLabel("Abgabezeit").fill("12:00");

    // Buchen ist gesperrt und der Hinweis erklärt warum.
    await expect(page.getByRole("button", { name: "Anfrage senden" })).toBeDisabled();
    await expect(
      page.getByText("Der gewählte Zeitraum ist blockiert oder bereits gebucht."),
    ).toBeVisible();
    await ctx.close();
  });
});
