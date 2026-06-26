import { test, expect, request as apiRequest, type APIRequestContext } from "@playwright/test";
import { createTool, createWorkshop, blockWorkshopSlot } from "./fixtures/api";
import { futureDate, uniqueSuffix } from "./fixtures/data";
import { readUsers, storageFileFor } from "./fixtures/roles";
import { PNG_DATA_URL, mockAddressValidation } from "./fixtures/forms";

/**
 * Verwalten eigener Angebote über die UI: Bearbeiten und Löschen von Werkzeugen
 * und Werkstätten (jeweils als Anbieter). Die Ausgangsdaten werden per API
 * angelegt, der eigentliche Verwalten-Flow läuft über den Browser.
 */
test.describe("Angebote verwalten (UI)", () => {
  test.use({ storageState: storageFileFor("anbieter") });

  test("Werkzeug bearbeiten ändert den Namen", async ({ page }) => {
    const users = readUsers();
    const api: APIRequestContext = await apiRequest.newContext();
    const tool = await createTool(api, users.anbieter.token, { name: `E2E Edit Tool ${uniqueSuffix()}` });
    await api.dispose();

    await mockAddressValidation(page);
    await page.goto(`/tools/${tool.id}/edit`);

    const newName = `${tool.name} bearbeitet`;
    await page.getByLabel("Name *").fill(newName);
    await page.getByRole("button", { name: "Änderungen speichern" }).click();

    await expect(page.locator(".toast-popup")).toContainText("Werkzeug aktualisiert.");
    await expect(page).toHaveURL(/\/tools\/.*manage=1/);
    await expect(page.getByText(newName).first()).toBeVisible();
  });

  test("Werkzeug löschen entfernt das Angebot", async ({ page }) => {
    const users = readUsers();
    const api: APIRequestContext = await apiRequest.newContext();
    const tool = await createTool(api, users.anbieter.token, { name: `E2E Delete Tool ${uniqueSuffix()}` });
    await api.dispose();

    await page.goto(`/tools/${tool.id}?manage=1`);
    await page.getByRole("button", { name: "Werkzeug löschen" }).click();
    await page.getByRole("button", { name: "Werkzeug endgültig löschen" }).click();

    await expect(page.locator(".toast-popup")).toContainText("Werkzeug endgültig gelöscht.");
    await expect(page).toHaveURL(/\/offers/);
  });

  test("Werkstatt bearbeiten ändert den Namen", async ({ page }) => {
    const users = readUsers();
    const api: APIRequestContext = await apiRequest.newContext();
    // Bearbeiten setzt mindestens ein Foto und ein Zeitfenster voraus.
    const workshop = await createWorkshop(api, users.anbieter.token, {
      name: `E2E Edit Workshop ${uniqueSuffix()}`,
      imageUrls: [PNG_DATA_URL],
    });
    const start = futureDate(10);
    const end = futureDate(11);
    await blockWorkshopSlot(api, users.anbieter.token, workshop.id, `${start.iso}T09:00`, `${end.iso}T12:00`);
    await api.dispose();

    await mockAddressValidation(page);
    await page.goto(`/workshops/${workshop.id}/edit`);

    const newName = `${workshop.name} bearbeitet`;
    const nameField = page.getByLabel("Werkstattname *");
    await expect(nameField).toHaveValue(workshop.name);
    await nameField.fill(newName);
    await page.getByRole("button", { name: "Änderungen speichern" }).click();

    await expect(page.locator(".toast-popup")).toContainText("Werkstatt aktualisiert.");
    await expect(page).toHaveURL(/\/workshops\/.*manage=1/);
  });

  test("Werkstatt löschen entfernt das Angebot", async ({ page }) => {
    const users = readUsers();
    const api: APIRequestContext = await apiRequest.newContext();
    const workshop = await createWorkshop(api, users.anbieter.token, {
      name: `E2E Delete Workshop ${uniqueSuffix()}`,
    });
    await api.dispose();

    await page.goto(`/workshops/${workshop.id}?manage=1`);
    await page.getByRole("button", { name: "Werkstatt löschen" }).click();
    await page.getByRole("button", { name: "Werkstatt endgültig löschen" }).click();

    await expect(page.locator(".toast-popup")).toContainText("Werkstatt endgültig gelöscht.");
    await expect(page).toHaveURL(/\/offers/);
  });
});
