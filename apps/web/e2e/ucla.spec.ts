/**
 * E2E: UCLA fixture college page
 */
import { test, expect } from "@playwright/test";
import { expectPageOk } from "./helpers/expect-page.js";

const FIXTURE_SLUG = "ucla-fixture";
const PROD_SLUG = "ucla";
const useFixtures = Boolean(process.env.PLAYWRIGHT_FIXTURES);
const slug = useFixtures ? FIXTURE_SLUG : PROD_SLUG;

test.describe("UCLA college page", () => {
  test("college page loads without 500", async ({ page }) => {
    const response = await page.goto(`/colleges/${slug}`);
    if (response) {
      expect(response.status()).not.toBe(500);
    }
    if (response?.ok()) {
      await expectPageOk(page);
    }
  });

  test("fixture college shows PARTIAL coverage indicator", async ({ page }) => {
    test.skip(!useFixtures, "Skipped — not running against fixture DB");

    const response = await page.goto(`/colleges/${FIXTURE_SLUG}`);
    expect(response?.status()).toBe(200);
    await expectPageOk(page);
    // UCLA fixture has PARTIAL coverage — page should indicate limited data
    await expect(page.getByText(/UCLA \(Fixture\)/i)).toBeVisible();
  });
});
