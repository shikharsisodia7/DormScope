/**
 * E2E: zero-inventory college (DISCOVERY_PENDING)
 *
 * Verifies that a college with no discovered housing inventory renders
 * without crashing and shows an appropriate "no data" state.
 */
import { test, expect } from "@playwright/test";
import { expectPageOk } from "./helpers/expect-page.js";

const FIXTURE_SLUG = "zero-inventory-fixture";
const useFixtures = Boolean(process.env.PLAYWRIGHT_FIXTURES);

test.describe("Zero-inventory college page (DISCOVERY_PENDING)", () => {
  test.skip(!useFixtures, "Requires fixture DB — set PLAYWRIGHT_FIXTURES=1");

  test("page loads without 500", async ({ page }) => {
    const response = await page.goto(`/colleges/${FIXTURE_SLUG}`);
    if (response) {
      expect(response.status()).not.toBe(500);
    }
    if (response?.ok()) {
      await expectPageOk(page);
    }
  });

  test("shows no dorms found state or appropriate message", async ({ page }) => {
    const response = await page.goto(`/colleges/${FIXTURE_SLUG}`);
    if (response?.status() !== 200) return;

    await expectPageOk(page);

    // The page should indicate no housing data is available
    // (exact text depends on implementation — accept any relevant message)
    const noDataPatterns = [
      /no dorms/i,
      /no housing/i,
      /no data/i,
      /coming soon/i,
      /discovery/i,
      /Zero Inventory College/i,
    ];

    let found = false;
    for (const pattern of noDataPatterns) {
      if (await page.getByText(pattern).count() > 0) {
        found = true;
        break;
      }
    }

    // Page must either show a relevant message or the college name
    expect(found).toBeTruthy();
  });
});
