/**
 * E2E: Admin routes — authentication gate
 *
 * Admin pages must not expose the ops console to unauthenticated users.
 * Next.js `redirect()` may soft-navigate (URL can remain /admin while home shell renders),
 * so we assert on content + API status rather than URL alone.
 */
import { test, expect } from "@playwright/test";

const ADMIN_ROUTES = [
  "/admin",
  "/admin/quality",
  "/admin/scraper",
] as const;

test.describe("Admin routes — unauthenticated access", () => {
  for (const route of ADMIN_ROUTES) {
    test(`${route} — redirects or returns auth error for unauthenticated users`, async ({
      page,
    }) => {
      const response = await page.goto(route);

      if (response) {
        expect(response.status()).not.toBe(500);
      }

      const finalUrl = page.url();
      const statusCode = response?.status() ?? 200;

      const leftAdminSurface =
        !new URL(finalUrl).pathname.startsWith("/admin") ||
        finalUrl.includes("/sign-in") ||
        finalUrl.includes("/login") ||
        finalUrl.includes("clerk") ||
        finalUrl.includes("accounts.");

      const isAccessDenied =
        statusCode === 401 ||
        statusCode === 403 ||
        statusCode === 404 ||
        (await page.getByText(/sign in|log in|unauthorized|forbidden|access denied|misconfigured/i).count()) >
          0;

      // Soft redirect: home chrome rendered, no admin console widgets
      const adminConsoleVisible =
        (await page.getByRole("heading", { name: /admin|quality console|scraper/i }).count()) > 0 &&
        (await page.getByText(/queue refresh|quarantine|ingestion jobs/i).count()) > 0;

      const publicShellVisible =
        (await page.getByRole("link", { name: "DormScope" }).count()) > 0 ||
        (await page.locator("header").count()) > 0;

      const deniedByContent = !adminConsoleVisible && publicShellVisible;

      expect(
        leftAdminSurface || isAccessDenied || deniedByContent || statusCode === 404
      ).toBeTruthy();
    });
  }

  test("/api/admin/overview — returns 401/403 without credentials", async ({ page }) => {
    const response = await page.request.get("/api/admin/overview");
    expect([401, 403, 404]).toContain(response.status());
  });

  test("/api/admin/export — returns 401/403 without credentials", async ({ page }) => {
    const response = await page.request.get("/api/admin/export");
    expect([401, 403, 404]).toContain(response.status());
  });

  test("/api/health — returns 200 (no auth required)", async ({ page }) => {
    const response = await page.request.get("/api/health");
    expect(response.status()).toBe(200);
  });
});
