/**
 * Reusable Playwright browser pool for scraper workers.
 * One browser process per worker; isolated contexts per site.
 */
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { assertSafeUrl, SafeUrlError } from "../security/ssrf.js";

let sharedBrowser: Browser | null = null;
let launching: Promise<Browser> | null = null;

export async function getSharedBrowser(): Promise<Browser> {
  if (sharedBrowser?.isConnected()) return sharedBrowser;
  if (launching) return launching;
  launching = chromium.launch({ headless: true }).then((b) => {
    sharedBrowser = b;
    launching = null;
    b.on("disconnected", () => {
      if (sharedBrowser === b) sharedBrowser = null;
    });
    return b;
  });
  return launching;
}

export async function closeSharedBrowser(): Promise<void> {
  if (sharedBrowser) {
    await sharedBrowser.close().catch(() => undefined);
    sharedBrowser = null;
  }
}

export async function withSafeContext<T>(
  fn: (ctx: { context: BrowserContext; page: Page }) => Promise<T>
): Promise<T> {
  const browser = await getSharedBrowser();
  const context = await browser.newContext({
    userAgent:
      process.env.SCRAPER_USER_AGENT ??
      "Mozilla/5.0 (compatible; DormScopeBot/1.3; +https://dormscope-six.vercel.app; research)",
  });
  const page = await context.newPage();

  // Request interception SSRF guard — block before navigation completes
  await page.route("**/*", async (route) => {
    const req = route.request();
    const url = req.url();
    try {
      if (url.startsWith("data:") || url.startsWith("blob:")) {
        await route.continue();
        return;
      }
      await assertSafeUrl(url);
      await route.continue();
    } catch (err) {
      if (err instanceof SafeUrlError) {
        await route.abort("blockedbyclient");
        return;
      }
      await route.abort("failed");
    }
  });

  try {
    return await fn({ context, page });
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
  }
}

export async function fetchHtmlWithPooledBrowser(
  url: string
): Promise<{ html: string | null; finalUrl: string; status: number }> {
  await assertSafeUrl(url);
  return withSafeContext(async ({ page }) => {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
    await page.waitForSelector("a, h1, h2, h3, .card, article", { timeout: 8000 }).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 400));
    const html = await page.content();
    return { html, finalUrl: page.url(), status: res?.status() ?? 0 };
  });
}
