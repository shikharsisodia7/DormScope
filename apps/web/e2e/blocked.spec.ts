/**
 * E2E: blocked college (BLOCKED coverage status)
 *
 * A BLOCKED college has had its scraper blocked (e.g. by robots.txt or CAPTCHA).
 * The page must render without 500 and show appropriate context.
 */
import { test, expect } from "@playwright/test";
import { expectPageOk } from "./helpers/expect-page.js";

const FIXTURE_SLUG = "blocked-fixture";
const useFixtures = Boolean(process.env.PLAYWRIGHT_FIXTURES);

test.describe("Blocked college page (BLOCKED coverage status)", () => {
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

  test("shows college name or blocked/no data state", async ({ page }) => {
    const response = await page.goto(`/colleges/${FIXTURE_SLUG}`);
    if (response?.status() !== 200) return;

    await expectPageOk(page);

    // Page should show the college name or relevant state
    const patterns = [
      /Blocked College/i,
      /no dorms/i,
      /no housing/i,
      /blocked/i,
    ];

    let found = false;
    for (const pattern of patterns) {
      if (await page.getByText(pattern).count() > 0) {
        found = true;
        break;
      }
    }
    expect(found).toBeTruthy();
  });
});
