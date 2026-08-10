/**
 * E2E: UC Berkeley fixture college page
 *
 * Verifies the college detail page and its dorms list render without errors.
 * When PLAYWRIGHT_FIXTURES=1 (CI with seeded test DB), asserts fixture-specific
 * content.  Against production or an unseeded DB the test falls back to
 * structural assertions only.
 */
import { test, expect } from "@playwright/test";
import { expectPageOk } from "./helpers/expect-page.js";

const FIXTURE_SLUG = "berkeley-fixture";
const PROD_SLUG = "university-of-california-berkeley";
const useFixtures = Boolean(process.env.PLAYWRIGHT_FIXTURES);
const slug = useFixtures ? FIXTURE_SLUG : PROD_SLUG;

test.describe("Berkeley college page", () => {
  test("college detail page loads", async ({ page }) => {
    const response = await page.goto(`/colleges/${slug}`);

    // 200 or 404 (if no fixture seeded on this environment) are both acceptable —
    // we just must not get a 500.
    if (response) {
      expect(response.status()).not.toBe(500);
    }

    if (response?.ok()) {
      await expectPageOk(page);
      // College name should appear somewhere on the page
      if (useFixtures) {
        await expect(page.getByRole("heading", { name: /UC Berkeley \(Fixture\)/i })).toBeVisible();
      }
    }
  });

  test("colleges list page loads and shows search", async ({ page }) => {
    await page.goto("/colleges");
    await expectPageOk(page);

    // Search input or list should be present
    const searchInput = page.getByRole("searchbox").or(
      page.getByPlaceholder(/search/i)
    );
    const hasList = (await page.locator("ul li, [role='listitem']").count()) > 0;
    const hasSearch = await searchInput.count() > 0;
    expect(hasSearch || hasList).toBeTruthy();
  });

  test("college dorms list visible when fixtures seeded", async ({ page }) => {
    test.skip(!useFixtures, "Skipped — not running against fixture DB");

    const response = await page.goto(`/colleges/${FIXTURE_SLUG}`);
    expect(response?.status()).toBe(200);
    await expectPageOk(page);

    // Fixture dorms: Unit 1, Unit 2
    await expect(page.getByRole("link", { name: /Unit 1/i }).first()).toBeVisible();
  });
});
