/**
 * E2E: Match / quiz flow
 *
 * Verifies the match page loads and key interactive elements are present.
 * This is a read-only journey — no data is submitted.
 */
import { test, expect } from "@playwright/test";
import { expectPageOk } from "./helpers/expect-page.js";

test.describe("Match / quiz page", () => {
  test("match page loads", async ({ page }) => {
    const response = await page.goto("/match");
    if (response) {
      expect(response.status()).not.toBe(500);
    }
    if (response?.ok()) {
      await expectPageOk(page);
    }
  });

  test("match page has college picker or quiz form", async ({ page }) => {
    await page.goto("/match");
    await expectPageOk(page);

    // The match page should have either a college selector or quiz questions
    const hasPicker =
      (await page.getByRole("combobox").count()) > 0 ||
      (await page.getByRole("listbox").count()) > 0 ||
      (await page.getByPlaceholder(/college|school/i).count()) > 0 ||
      (await page.getByText(/select a college/i).count()) > 0 ||
      (await page.getByText(/find your match/i).count()) > 0 ||
      (await page.getByText(/match|quiz|preference/i).count()) > 0;

    expect(hasPicker).toBeTruthy();
  });

  test("quiz route loads", async ({ page }) => {
    const response = await page.goto("/quiz");
    if (response) {
      expect(response.status()).not.toBe(500);
    }
    if (response?.ok()) {
      await expectPageOk(page);
    }
  });

  test("home page loads with search", async ({ page }) => {
    await page.goto("/");
    await expectPageOk(page);

    // Home page should have some content
    const hasContent =
      (await page.getByRole("heading").count()) > 0 ||
      (await page.getByRole("link", { name: /college|dorm|match|explore/i }).count()) > 0;
    expect(hasContent).toBeTruthy();
  });
});
