import { defineConfig, devices } from "@playwright/test";

/**
 * Read environment variables from .env if present.
 * @see https://playwright.dev/docs/test-configuration
 */

/**
 * Base URL resolution:
 *  - E2E_BASE_URL (e.g. https://dormscope-six.vercel.app) → smoke against production.
 *  - Otherwise defaults to localhost:3000 where the webServer is started.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const isExternalTarget = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-mobile",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 375, height: 812 },
      },
    },
  ],

  outputDir: "test-results",

  /**
   * Start the Next.js production server when running against the local test DB.
   * For external targets (E2E_BASE_URL set) or local dev, skip the webServer.
   *
   * CI workflow must:
   *  1. Run: npm run build --workspace=@dormscope/web
   *  2. Set DATABASE_URL_TEST
   *  3. Run: npm run test:e2e
   */
  webServer: isExternalTarget
    ? undefined
    : {
        command: "npm run start --workspace=@dormscope/web",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          // Use test DB URL if available; fall back to DATABASE_URL
          DATABASE_URL:
            process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? "",
          NODE_ENV: "test",
          // Pass through required public env vars
          NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
          NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "",
        },
      },
});
