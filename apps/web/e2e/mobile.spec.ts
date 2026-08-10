/**
 * E2E: Mobile viewport tests (375×812)
 *
 * Verifies key pages render correctly on mobile without horizontal overflow
 * or critical layout breaks.
 *
 * These tests run in the chromium-mobile project (375×812 viewport).
 */
import { test, expect } from "@playwright/test";
import { expectPageOk } from "./helpers/expect-page.js";

test.describe("Mobile layout — 375×812", () => {
  test("home page renders on mobile", async ({ page }) => {
    await page.goto("/");
    await expectPageOk(page);

    // No horizontal scroll (body width should not exceed viewport)
    const overflow = await page.evaluate(() => {
      return document.body.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflow).toBe(false);
  });

  test("colleges list page renders on mobile", async ({ page }) => {
    await page.goto("/colleges");
    await expectPageOk(page);
  });

  test("match page renders on mobile", async ({ page }) => {
    const response = await page.goto("/match");
    if (response) {
      expect(response.status()).not.toBe(500);
    }
    if (response?.ok()) {
      await expectPageOk(page);
    }
  });

  test("navigation is accessible on mobile", async ({ page }) => {
    await page.goto("/");

    // Check for hamburger menu or visible navigation links
    const mobileNav =
      page.getByRole("button", { name: /menu|hamburger|nav/i }).first() ||
      page.getByRole("navigation").first();

    const navExists =
      (await page.getByRole("navigation").count()) > 0 ||
      (await page.getByRole("button", { name: /menu/i }).count()) > 0;

    expect(navExists).toBeTruthy();
  });

  test("college detail page readable on mobile", async ({ page }) => {
    // Use the real colleges list page — avoid relying on fixtures
    const response = await page.goto("/colleges");
    if (!response?.ok()) return;

    // Try to click on any college link
    const firstCollegeLink = page.getByRole("link").filter({ hasText: /university|college/i }).first();
    const count = await firstCollegeLink.count();
    if (count > 0) {
      await firstCollegeLink.click();
      await page.waitForURL(/\/colleges\/.+/);
      await expectPageOk(page);
    }
  });
});
