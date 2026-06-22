import { defineConfig, devices } from "@playwright/test";

/**
 * E2E-Konfiguration für ToolShare.
 *
 * Annahme: Der komplette Stack (Frontend :3000, Backend :4000, Postgres) läuft
 * bereits – lokal am einfachsten über `docker compose up`. Playwright startet
 * deshalb keinen zweiten Server, sondern verwendet den laufenden wieder
 * (`reuseExistingServer`). Ist auf :3000 nichts erreichbar, startet Playwright
 * ersatzweise den Vite-Dev-Server (Backend muss dann separat laufen).
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["junit", { outputFile: "playwright-junit.xml" }],
  ],
  outputDir: "test-results",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
      teardown: "cleanup",
    },
    {
      // Räumt nach allen Tests die angelegten E2E-Daten wieder ab.
      name: "cleanup",
      testMatch: /global\.teardown\.ts/,
    },
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      // Mobile läuft bewusst nur auf den Smoke-Flows (Tag @smoke), damit die
      // Suite schnell und stabil bleibt.
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
      dependencies: ["setup"],
      grep: /@smoke/,
    },
    {
      // Cross-Browser-Absicherung über die Safari-/WebKit-Engine – ebenfalls nur
      // auf den Smoke-Flows, um Engine-spezifische Regressionen zu fangen, ohne
      // die ganze Suite mehrfach zu fahren.
      name: "webkit-smoke",
      use: { ...devices["Desktop Safari"] },
      dependencies: ["setup"],
      grep: /@smoke/,
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
