import {
  prisma,
  ScrapeJobStatus,
  SourceType,
  HousingCoverageStatus,
} from "@dormscope/database";
import { chromium } from "playwright";
import { parseHousingHtmlDetailed, parsePageMetadata } from "../html/parsePage.js";
import {
  extractDomain,
  isOfficialDomain,
  guessHousingCandidateUrls,
} from "../discovery/queries.js";
import { sourceConfidence } from "../confidence/score.js";
import { assertSafeUrl, SafeUrlError, fetchHtmlSafe } from "../security/ssrf.js";
import { persistExtractedDorm, upsertPageSource } from "../ingest/persistDorm.js";

const UA =
  process.env.SCRAPER_USER_AGENT ??
  "Mozilla/5.0 (compatible; DormScopeBot/1.2; +https://dormscope-six.vercel.app; research)";

const ENABLE_PLAYWRIGHT = process.env.SCRAPER_ENABLE_PLAYWRIGHT === "1";
const MAX_PAGES = Number(process.env.SCRAPER_MAX_PAGES ?? 18);
const FETCH_DELAY_MS = Number(process.env.SCRAPER_RATE_LIMIT_MS ?? 350);
const EXTRACTOR_VERSION = "parseHousingHtmlDetailed@2";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtmlWithPlaywright(url: string): Promise<{ html: string | null; finalUrl: string; status: number }> {
  await assertSafeUrl(url);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ "User-Agent": UA });
    page.on("framenavigated", async (frame) => {
      if (frame === page.mainFrame()) {
        try {
          await assertSafeUrl(frame.url());
        } catch {
          await page.close().catch(() => undefined);
        }
      }
    });
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
    await page.waitForSelector("a, h1, h2, h3, .card, article", { timeout: 8000 }).catch(() => undefined);
    await sleep(Math.min(FETCH_DELAY_MS, 1200));
    const html = await page.content();
    return { html, finalUrl: page.url(), status: res?.status() ?? 0 };
  } finally {
    await browser.close();
  }
}

type FrontierItem = { url: string; priority: number; depth: number };

function scoreUrl(u: string, housingUrl?: string | null): number {
  let s = 0;
  if (housingUrl && u === housingUrl) s += 100;
  if (/housing\.|reslife\.|residentiallife\./i.test(u)) s += 50;
  if (/residence-halls|housing-options|residences|explore-housing/i.test(u)) s += 40;
  if (/rates|room-type|floor-plan|amenities/i.test(u)) s += 15;
  if (/apply|login|portal|news|event/i.test(u)) s -= 20;
  return s;
}

async function discoverSitemapUrls(websiteUrl: string | null | undefined, domain: string): Promise<string[]> {
  if (!websiteUrl) return [];
  const roots = [
    new URL("/sitemap.xml", websiteUrl).toString(),
    new URL("/sitemap_index.xml", websiteUrl).toString(),
  ];
  const found: string[] = [];
  for (const sm of roots) {
    try {
      const res = await fetchHtmlSafe(sm, { userAgent: UA, timeoutMs: 12000 });
      if (!res.html) continue;
      const locs = Array.from(res.html.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)).map((m) => m[1].trim());
      for (const loc of locs) {
        if (/housing|residence|residential|res-?life|living/i.test(loc) && isOfficialDomain(loc, domain)) {
          found.push(loc);
        }
      }
    } catch {
      /* ignore */
    }
  }
  return found.slice(0, 20);
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

  await prisma.ingestCheckpoint.upsert({
    where: { collegeId: college.id },
    create: {
      collegeId: college.id,
      stage: "discover",
      status: "running",
      lockedAt: new Date(),
      lockOwner: job.id,
    },
    update: {
      stage: "discover",
      status: "running",
      lockedAt: new Date(),
      lockOwner: job.id,
      lastError: null,
    },
  });

  const domain = extractDomain(college.websiteUrl);
  const frontier: FrontierItem[] = [];
  const seen = new Set<string>();

  const enqueue = (url: string, depth: number) => {
    try {
      const abs = new URL(url).toString();
      if (seen.has(abs)) return;
      if (domain && !isOfficialDomain(abs, domain) && !college.housingUrl) return;
      seen.add(abs);
      frontier.push({ url: abs, priority: scoreUrl(abs, college.housingUrl), depth });
    } catch {
      /* ignore */
    }
  };

  for (const u of guessHousingCandidateUrls(college.websiteUrl, college.housingUrl)) {
    enqueue(u, 0);
  }
  for (const u of await discoverSitemapUrls(college.websiteUrl, domain || "")) {
    enqueue(u, 0);
  }

  // Homepage nav discovery
  if (college.websiteUrl) {
    try {
      const home = await fetchHtmlSafe(college.websiteUrl, { userAgent: UA });
      if (home.html) {
        const meta = parsePageMetadata(home.html, home.finalUrl);
        for (const link of meta.links) enqueue(link, 1);
      }
    } catch (err) {
      await log("warn", `Homepage discovery failed: ${(err as Error).message}`);
    }
  }

  frontier.sort((a, b) => b.priority - a.priority);

  let dormsFound = 0;
  let pagesVisited = 0;
  let bestHousingUrl: string | null = college.housingUrl;
  let blocked = false;
  let lastHttpStatus: number | undefined;

  try {
    await log("info", `Starting crawl for ${college.name} (frontier ${frontier.length})`);
    await prisma.scrapeJob.update({
      where: { id: job.id },
      data: { stage: "extract", candidateUrls: frontier.slice(0, 40).map((f) => f.url) },
    });

    while (frontier.length > 0 && pagesVisited < MAX_PAGES) {
      frontier.sort((a, b) => b.priority - a.priority || a.depth - b.depth);
      const item = frontier.shift()!;
      if (item.depth > 3) continue;

      try {
        await assertSafeUrl(item.url);
        await log("info", `Fetching depth=${item.depth}`, item.url);
        await sleep(FETCH_DELAY_MS);

        let fetched = await fetchHtmlSafe(item.url, { userAgent: UA });
        lastHttpStatus = fetched.status;
        if (fetched.status === 403 || fetched.status === 401 || fetched.status === 429) {
          blocked = true;
          await log("warn", `Access restricted HTTP ${fetched.status}`, item.url);
          if (ENABLE_PLAYWRIGHT) {
            fetched = await fetchHtmlWithPlaywright(item.url);
            lastHttpStatus = fetched.status;
          }
        }

        let html = fetched.html;
        let usedBrowser = false;
        if ((!html || html.length < 500) && ENABLE_PLAYWRIGHT) {
          const pw = await fetchHtmlWithPlaywright(item.url);
          html = pw.html;
          fetched = { ...fetched, ...pw, contentHash: fetched.contentHash };
          usedBrowser = true;
        }

        if (!html) {
          await log("warn", `No HTML retrieved (${fetched.status})`, item.url);
          continue;
        }

        pagesVisited += 1;
        const parsed = parseHousingHtmlDetailed(html, fetched.finalUrl);
        const meta = parsePageMetadata(html, fetched.finalUrl);

        // Expand frontier from housing pages
        if (parsed.pageRoles.some((r) => r !== "irrelevant") && item.depth < 3) {
          for (const link of meta.links.slice(0, 25)) {
            enqueue(link, item.depth + 1);
          }
        }

        if (parsed.accepted.length === 0) {
          await log("warn", `No accepted housing candidates (${parsed.rejected.length} rejected)`, item.url);
          continue;
        }

        if (!bestHousingUrl || parsed.accepted.length >= 3) {
          bestHousingUrl = fetched.finalUrl;
        }

        const official = domain ? isOfficialDomain(fetched.finalUrl, domain) : true;
        const source = await upsertPageSource({
          collegeId: college.id,
          url: item.url,
          finalUrl: fetched.finalUrl,
          title: `${college.name} housing page`,
          sourceType: official ? SourceType.OFFICIAL_WEBSITE : SourceType.OTHER,
          confidence: sourceConfidence(SourceType.OFFICIAL_WEBSITE),
          isApproved: official,
          rawSnippet: html.slice(0, 2000),
          contentHash: fetched.contentHash,
          httpStatus: fetched.status,
          extractorVersion: EXTRACTOR_VERSION,
          pageRole: parsed.pageRoles.join(","),
        });

        for (const rej of parsed.rejected.slice(0, 30)) {
          await prisma.extractionDecision.create({
            data: {
              collegeId: college.id,
              sourceId: source.id,
              candidateName: rej.name,
              accepted: false,
              confidence: rej.classification.confidence,
              reasons: rej.classification.reasons,
              pageUrl: fetched.finalUrl,
            },
          });
        }

        await log(
          "info",
          `Accepted ${parsed.accepted.length} / rejected ${parsed.rejected.length} via ${usedBrowser ? "playwright" : "cheerio"}`,
          item.url
        );

        for (const ex of parsed.accepted) {
          const result = await persistExtractedDorm(ex, {
            collegeId: college.id,
            sourceUrl: fetched.finalUrl,
            sourceId: source.id,
            isOfficial: official,
          });
          if (result) {
            dormsFound += 1;
            await prisma.extractionDecision.create({
              data: {
                collegeId: college.id,
                sourceId: source.id,
                dormId: result.dormId,
                candidateName: ex.name,
                accepted: true,
                confidence: ex.classification?.confidence ?? 0.6,
                reasons: ex.classification?.reasons ?? ["accepted"],
                pageUrl: fetched.finalUrl,
              },
            });
          }
        }
      } catch (err) {
        const msg =
          err instanceof SafeUrlError
            ? `SSRF blocked: ${err.message}`
            : `Failed ${item.url}: ${(err as Error).message}`;
        await log("error", msg, item.url);
      }
    }

    let coverage: HousingCoverageStatus;
    if (dormsFound > 0) {
      coverage = dormsFound >= 8 ? HousingCoverageStatus.COMPLETE : HousingCoverageStatus.PARTIAL;
    } else if (college.hasResidentialHousing === false) {
      coverage = HousingCoverageStatus.NO_HOUSING;
    } else if (blocked) {
      coverage = HousingCoverageStatus.BLOCKED;
    } else if (bestHousingUrl && !college.housingUrl) {
      coverage = HousingCoverageStatus.SITE_FOUND;
    } else {
      coverage = HousingCoverageStatus.RETRYABLE;
    }

    await prisma.college.update({
      where: { id: college.id },
      data: {
        housingCoverageStatus: coverage,
        ...(bestHousingUrl ? { housingUrl: bestHousingUrl } : {}),
        ...(dormsFound > 0 ? { hasResidentialHousing: true } : {}),
        dataFreshnessAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    });

    await prisma.ingestCheckpoint.update({
      where: { collegeId: college.id },
      data: {
        stage: dormsFound > 0 ? "complete" : "directory",
        status:
          coverage === HousingCoverageStatus.BLOCKED
            ? "blocked"
            : coverage === HousingCoverageStatus.RETRYABLE
              ? "retryable"
              : dormsFound > 0
                ? "complete"
                : "retryable",
        pagesVisited,
        candidateUrls: Array.from(seen).slice(0, 50),
        lastHttpStatus: lastHttpStatus ?? null,
        lastSuccessAt: dormsFound > 0 ? new Date() : undefined,
        lockedAt: null,
        lockOwner: null,
        failureClass: blocked ? "access_restricted" : dormsFound === 0 ? "empty_extraction" : null,
      },
    });

    await prisma.scrapeJob.update({
      where: { id: job.id },
      data: {
        status: ScrapeJobStatus.COMPLETED,
        completedAt: new Date(),
        candidateUrls: Array.from(seen).slice(0, 40),
        dormsFound,
        stage: "complete",
      },
    });

    await log("info", `Completed. ${dormsFound} dorms from ${pagesVisited} pages.`);
    return { jobId: job.id, dormsFound, housingUrl: bestHousingUrl, pagesVisited, coverage };
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
    await prisma.ingestCheckpoint.update({
      where: { collegeId: college.id },
      data: {
        status: "failed",
        lastError: (err as Error).message,
        retryCount: { increment: 1 },
        nextRetryAt: new Date(Date.now() + 60 * 60 * 1000),
        lockedAt: null,
        lockOwner: null,
      },
    });
    await log("error", (err as Error).message);
    throw err;
  }
}
