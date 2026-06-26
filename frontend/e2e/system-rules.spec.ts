import { test, expect } from "@playwright/test";
import { storageFileFor } from "./fixtures/roles";

/**
 * Admin-Tab „Systemregeln": Manager kann erzwungene Plattformwerte anpassen.
 */
test.describe("Admin – Systemregeln", () => {
  test.use({ storageState: storageFileFor("manager") });

  test("Manager kann eine Systemregel speichern", async ({ page }) => {
    await page.goto("/admin");
    await page.getByRole("button", { name: "Systemregeln" }).click();

    const row = page.getByRole("listitem").filter({ hasText: "Maximale Ausleihdauer eines Werkzeugs" });
    const input = row.getByLabel("Maximale Ausleihdauer eines Werkzeugs");
    await expect(input).toBeVisible();

    const current = await input.inputValue();
    const next = current === "14" ? "15" : "14";

    await input.fill(next);
    const saveButton = row.getByRole("button", { name: "Speichern" });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect(page.locator(".toast-popup")).toContainText("Einstellung wurde gespeichert.");
    await expect(input).toHaveValue(next);
  });
});
