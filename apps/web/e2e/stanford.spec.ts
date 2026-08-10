/**
 * E2E: Stanford fixture college page
 */
import { test, expect } from "@playwright/test";
import { expectPageOk } from "./helpers/expect-page.js";

const FIXTURE_SLUG = "stanford-fixture";
const PROD_SLUG = "stanford-university";
const useFixtures = Boolean(process.env.PLAYWRIGHT_FIXTURES);
const slug = useFixtures ? FIXTURE_SLUG : PROD_SLUG;

test.describe("Stanford college page", () => {
  test("college page loads without 500", async ({ page }) => {
    const response = await page.goto(`/colleges/${slug}`);
    if (response) {
      expect(response.status()).not.toBe(500);
    }
    if (response?.ok()) {
      await expectPageOk(page);
    }
  });

  test("fixture college found in search", async ({ page }) => {
    test.skip(!useFixtures, "Skipped — not running against fixture DB");

    await page.goto("/colleges");
    await expectPageOk(page);

    const searchInput = page.getByRole("searchbox").or(
      page.getByPlaceholder(/search/i)
    );
    if (await searchInput.count() > 0) {
      await searchInput.first().fill("Stanford");
      await page.waitForTimeout(500);
      // Should show the fixture or production Stanford entry
      const stanfordLink = page.getByText(/Stanford/i).first();
      await expect(stanfordLink).toBeVisible();
    }
  });
});
