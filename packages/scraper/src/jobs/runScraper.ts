import { prisma, ScrapeJobStatus, SourceType } from "@dormscope/database";
import { chromium } from "playwright";
import { parseHousingHtml } from "../html/parsePage.js";
import { housingSearchQueries, extractDomain, isOfficialDomain } from "../discovery/queries.js";
import { sourceConfidence } from "../confidence/score.js";
import { assertSafeUrl, SafeUrlError } from "../security/ssrf.js";
import { persistExtractedDorm } from "../ingest/persistDorm.js";

async function fetchHtmlWithCheerio(url: string): Promise<string | null> {
  await assertSafeUrl(url);
  const res = await fetch(url, {
    headers: {
      "User-Agent": process.env.SCRAPER_USER_AGENT ?? "DormScopeBot/1.0 (+https://dormscope.app)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) return null;
  const ct = res.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml/i.test(ct) && ct !== "") {
    // still try if content-type missing
    if (ct && !/html|text|xml/i.test(ct)) return null;
  }
  return await res.text();
}

async function fetchHtmlWithPlaywright(url: string): Promise<string | null> {
  await assertSafeUrl(url);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
      "User-Agent": process.env.SCRAPER_USER_AGENT ?? "DormScopeBot/1.0",
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, Number(process.env.SCRAPER_RATE_LIMIT_MS ?? 2000)));
    return await page.content();
  } finally {
    await browser.close();
  }
}

export async function runScraperForCollege(collegeSlug: string) {
  const college = await prisma.college.findUnique({ where: { slug: collegeSlug } });
  if (!college) throw new Error(`College not found: ${collegeSlug}`);

  const job = await prisma.scrapeJob.create({
    data: {
      collegeId: college.id,
      status: ScrapeJobStatus.RUNNING,
      startedAt: new Date(),
      candidateUrls: [],
      stage: "discover",
    },
  });

  const log = async (level: string, message: string, url?: string) => {
    await prisma.scrapeLog.create({ data: { jobId: job.id, level, message, url } });
  };

  const candidateUrls: string[] = [];
  if (college.housingUrl) candidateUrls.push(college.housingUrl);

  const domain = extractDomain(college.websiteUrl);
  const queries = housingSearchQueries(college.name);

  if (college.websiteUrl) {
    const base = college.websiteUrl.replace(/\/$/, "");
    // Use search queries to derive common housing path candidates (not empty forEach)
    const pathHints = [
      "/housing",
      "/residence-life",
      "/residential-life",
      "/student-life/housing",
      "/campus-life/housing",
    ];
    for (const path of pathHints) {
      candidateUrls.push(`${base}${path}`);
    }
    await log("info", `Discovery queries prepared: ${queries.slice(0, 3).join("; ")}`);
  }

  // Deduplicate candidates
  const uniqueUrls = Array.from(new Set(candidateUrls)).slice(0, 5);
  let dormsFound = 0;

  try {
    await log("info", `Starting scrape for ${college.name}`);

    for (const url of uniqueUrls) {
      try {
        // Gate: official domain preferred; always SSRF-check
        const official = domain ? isOfficialDomain(url, domain) : false;
        if (domain && !official && !college.housingUrl) {
          await log("warn", `Skipping non-official URL`, url);
          continue;
        }

        await assertSafeUrl(url);
        await log("info", `Fetching ${url}`, url);

        let html = await fetchHtmlWithCheerio(url);
        let usedBrowser = false;
        let extracted = html ? parseHousingHtml(html, url) : [];

        // Playwright only if cheerio found nothing useful
        if (!html || extracted.length === 0) {
          await log("info", `Cheerio insufficient; trying Playwright`, url);
          html = await fetchHtmlWithPlaywright(url);
          usedBrowser = true;
          extracted = html ? parseHousingHtml(html, url) : [];
        }

        if (!html) {
          await log("warn", `No HTML retrieved`, url);
          continue;
        }

        const source = await prisma.source.create({
          data: {
            collegeId: college.id,
            url,
            title: `${college.name} housing page`,
            sourceType: official ? SourceType.OFFICIAL_WEBSITE : SourceType.OTHER,
            confidence: sourceConfidence(SourceType.OFFICIAL_WEBSITE),
            scrapedAt: new Date(),
            isApproved: official,
            rawSnippet: html.slice(0, 2000),
          },
        });

        await log(
          "info",
          `Parsed ${extracted.length} hall candidates via ${usedBrowser ? "playwright" : "cheerio"}`,
          url
        );

        for (const ex of extracted) {
          const result = await persistExtractedDorm(ex, {
            collegeId: college.id,
            sourceUrl: url,
            sourceId: source.id,
            isOfficial: official,
          });
          if (result) dormsFound++;
        }
      } catch (err) {
        const msg =
          err instanceof SafeUrlError
            ? `SSRF blocked: ${err.message}`
            : `Failed ${url}: ${(err as Error).message}`;
        await log("error", msg, url);
      }
    }

    const coverage =
      dormsFound > 0
        ? "PARTIAL"
        : college.hasResidentialHousing === false
          ? "NO_HOUSING"
          : "FAILED";

    await prisma.college.update({
      where: { id: college.id },
      data: {
        housingCoverageStatus: coverage as never,
        dataFreshnessAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    });

    await prisma.scrapeJob.update({
      where: { id: job.id },
      data: {
        status: ScrapeJobStatus.COMPLETED,
        completedAt: new Date(),
        candidateUrls: uniqueUrls,
        dormsFound,
        stage: "complete",
      },
    });

    await log("info", `Completed. ${dormsFound} dorms processed.`);
    return { jobId: job.id, dormsFound };
  } catch (err) {
    await prisma.scrapeJob.update({
      where: { id: job.id },
      data: {
        status: ScrapeJobStatus.FAILED,
        errorMessage: (err as Error).message,
        completedAt: new Date(),
        lastError: (err as Error).message,
      },
    });
    await log("error", (err as Error).message);
    throw err;
  }
}
