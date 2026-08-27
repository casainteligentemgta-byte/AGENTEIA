import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E — API SmartImport (no hay UI /import en el paquete).
 * Arranca harness en globalSetup (puerto 3100).
 */
export default defineConfig({
  testDir: "./",
  testMatch: /.*\.e2e\.ts/,
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    extraHTTPHeaders: {
      Authorization: "Bearer e2e-test-token",
      "Content-Type": "application/json",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  globalSetup: require.resolve("./global-setup.ts"),
  globalTeardown: require.resolve("./global-teardown.ts"),
});
