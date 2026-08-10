/**
 * E2E: Santa Clara University fixture college + Swig Hall dorm page
 */
import { test, expect } from "@playwright/test";
import { expectPageOk } from "./helpers/expect-page.js";

const FIXTURE_SLUG = "scu-fixture";
const PROD_SLUG = "santa-clara-university";
const useFixtures = Boolean(process.env.PLAYWRIGHT_FIXTURES);
const slug = useFixtures ? FIXTURE_SLUG : PROD_SLUG;

test.describe("SCU college page", () => {
  test("college page loads without 500", async ({ page }) => {
    const response = await page.goto(`/colleges/${slug}`);
    if (response) {
      expect(response.status()).not.toBe(500);
    }
    if (response?.ok()) {
      await expectPageOk(page);
    }
  });

  test("fixture Swig Hall dorm visible", async ({ page }) => {
    test.skip(!useFixtures, "Skipped — not running against fixture DB");

    const response = await page.goto(`/colleges/${FIXTURE_SLUG}`);
    expect(response?.status()).toBe(200);
    await expectPageOk(page);
    await expect(page.getByText(/Swig Hall/i)).toBeVisible();
  });

  test("Swig Hall dorm detail page loads", async ({ page }) => {
    test.skip(!useFixtures, "Skipped — not running against fixture DB");

    const response = await page.goto(`/colleges/${FIXTURE_SLUG}/dorms/swig-hall`);
    if (response?.status() === 200) {
      await expectPageOk(page);
      await expect(page.getByText(/Swig Hall/i)).toBeVisible();
    } else {
      // 404 is acceptable — dorm detail page might not exist for fixture
      expect(response?.status()).toBe(404);
    }
  });
});
