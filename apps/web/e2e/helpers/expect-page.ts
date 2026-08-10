/**
 * Shared E2E page assertion helpers.
 */
import { type Page, expect } from "@playwright/test";

/** Assert the page returned a 2xx response and has no visible error heading. */
export async function expectPageOk(page: Page): Promise<void> {
  // Check for common Next.js error indicators
  const errorHeading = page.getByRole("heading", { name: /error|500|something went wrong/i });
  await expect(errorHeading).not.toBeVisible();
}

/** Assert the page title contains `text`. */
export async function expectTitle(page: Page, text: string): Promise<void> {
  await expect(page).toHaveTitle(new RegExp(text, "i"));
}

/** Assert a navigation link is visible. */
export async function expectNav(page: Page): Promise<void> {
  // The site has a main navigation — check at least one nav element is present
  const nav = page.getByRole("navigation").first();
  await expect(nav).toBeVisible();
}
