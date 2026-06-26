import { expect, request as apiRequest, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { createTool, type CreatedTool } from "./api";
import { futureDate, uniqueSuffix } from "./data";
import { readUsers, storageFileFor } from "./roles";

/** Legt ein eindeutiges Werkzeug für den geteilten Anbieter an. */
export async function seedTool(namePrefix: string): Promise<CreatedTool> {
  const users = readUsers();
  const api: APIRequestContext = await apiRequest.newContext();
  const tool = await createTool(api, users.anbieter.token, {
    name: `${namePrefix} ${uniqueSuffix()}`,
  });
  await api.dispose();
  return tool;
}

/** Stellt über die Werkzeug-Detailseite eine Ausleihanfrage (mit Abholzeit). */
export async function submitToolRequest(
  page: Page,
  toolId: string,
  startDaysAhead = 3,
  endDaysAhead = 5,
): Promise<void> {
  const start = futureDate(startDaysAhead);
  const end = futureDate(endDaysAhead);

  await page.goto(`/tools/${toolId}`);
  await page.getByLabel("Abholdatum").fill(start.display);
  await page.getByLabel("Abholzeit").fill("10:00");
  await page.getByLabel("Abgabedatum").fill(end.display);
  await page.getByLabel("Abgabezeit").fill("16:00");
  await page.getByRole("button", { name: "Anfrage senden" }).click();
  await page.waitForURL(/\/inbox/);
}

/** Öffnet in der Inbox den Thread zu einem Werkzeugnamen. */
export async function openInboxThread(page: Page, toolName: string): Promise<void> {
  await page.goto("/inbox");
  await page.locator(".messenger-thread-item", { hasText: toolName }).first().click();
}

/** Anbieter akzeptiert eine offene Ausleihanfrage in der Inbox. */
export async function acceptBookingAsProvider(browser: Browser, toolName: string): Promise<void> {
  const ctx = await browser.newContext({ storageState: storageFileFor("anbieter") });
  const page = await ctx.newPage();
  await openInboxThread(page, toolName);
  await page.getByRole("button", { name: "Akzeptieren" }).click();
  await expect(page.getByText("Anfrage angenommen")).toBeVisible();
  await ctx.close();
}

/** Anbieter markiert eine bestätigte Buchung als abgeschlossen. */
export async function completeBookingAsProvider(browser: Browser, toolName: string): Promise<void> {
  const ctx = await browser.newContext({ storageState: storageFileFor("anbieter") });
  const page = await ctx.newPage();
  await openInboxThread(page, toolName);
  await page.getByRole("button", { name: "Als abgeschlossen markieren" }).click();
  await expect(page.locator(".toast-popup")).toContainText("Buchung als abgeschlossen markiert.");
  await ctx.close();
}
