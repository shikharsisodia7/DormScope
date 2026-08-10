import {
  prisma,
  ScrapeJobStatus,
  SourceType,
  HousingCoverageStatus,
} from "@dormscope/database";
import { parseHousingHtmlDetailed, parsePageMetadata } from "../html/parsePage.js";
import {
  extractDomain,
  isOfficialDomain,
  guessHousingCandidateUrls,
} from "../discovery/queries.js";
import { sourceConfidence } from "../confidence/score.js";
import { assertSafeUrl, SafeUrlError, fetchHtmlSafe } from "../security/ssrf.js";
import { persistExtractedDorm, upsertPageSource } from "../ingest/persistDorm.js";
import { decideHousingCoverage } from "./coverageDecision.js";
import { DomainRateLimiter } from "../net/domainRateLimiter.js";
import { fetchHtmlWithPooledBrowser, closeSharedBrowser } from "../browser/pool.js";
import { extractDetailFacts } from "../enrich/detailFacts.js";
import { enrichCollegeHierarchy } from "../enrich/hierarchy.js";

const UA =
  process.env.SCRAPER_USER_AGENT ??
  "Mozilla/5.0 (compatible; DormScopeBot/1.3; +https://dormscope-six.vercel.app; research)";

const ENABLE_PLAYWRIGHT = process.env.SCRAPER_ENABLE_PLAYWRIGHT === "1";
const MAX_PAGES = Number(process.env.SCRAPER_MAX_PAGES ?? 18);
const FETCH_DELAY_MS = Number(process.env.SCRAPER_RATE_LIMIT_MS ?? 350);
const EXTRACTOR_VERSION = "parseHousingHtmlDetailed@4";
const MODE = process.env.SCRAPE_MODE ?? "full"; // discovery | full | validate | enrich | hierarchy

const domainLimiter = new DomainRateLimiter({
  minSpacingMs: Number(process.env.SCRAPER_DOMAIN_SPACING_MS ?? 800),
  maxConcurrentPerDomain: Number(process.env.SCRAPER_DOMAIN_CONCURRENCY ?? 1),
});

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

async function fetchHtmlWithPlaywright(
  url: string
): Promise<{ html: string | null; finalUrl: string; status: number }> {
  return fetchHtmlWithPooledBrowser(url);
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

async function discoverSitemapUrls(
  websiteUrl: string | null | undefined,
  domain: string
): Promise<string[]> {
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
      const locs = Array.from(res.html.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)).map((m) =>
        m[1].trim()
      );
      for (const loc of locs) {
        if (
          /housing|residence|residential|res-?life|living/i.test(loc) &&
          isOfficialDomain(loc, domain)
        ) {
          found.push(loc);
        }
      }
    } catch {
      /* ignore */
    }
  }
  return found.slice(0, 20);
}

export interface ScraperRunResult {
  jobId: string;
  acceptedCandidates: number;
  newEntitiesCreated: number;
  existingEntitiesUpdated: number;
  uniqueEntitiesSeenThisRun: number;
  duplicatesSuppressed: number;
  rejectedCandidates: number;
  pagesVisited: number;
  directoryPagesVisited: number;
  detailPagesVisited: number;
  unresolvedHousingLinks: number;
  officialDirectorySourcesFound: number;
  unchangedPagesSkipped: number;
  /** @deprecated use uniqueEntitiesSeenThisRun — kept for callers */
  dormsFound: number;
  housingUrl: string | null;
  coverage: HousingCoverageStatus;
}

export async function runScraperForCollege(
  collegeSlug: string,
  opts?: { workerId?: string; forceRefresh?: boolean; mode?: string }
): Promise<ScraperRunResult> {
  const college = await prisma.college.findUnique({ where: { slug: collegeSlug } });
  if (!college) throw new Error(`College not found: ${collegeSlug}`);

  const scrapeMode = opts?.mode ?? MODE;
  const workerId = opts?.workerId ?? null;
  const forceRefresh = opts?.forceRefresh === true || process.env.FORCE_REFRESH === "1";

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

  // Preserve outer worker lock owner when present; attach scrape job id as stage metadata
  const existingCp = await prisma.ingestCheckpoint.findUnique({ where: { collegeId: college.id } });
  const lockOwner = existingCp?.lockOwner ?? workerId ?? job.id;

  await prisma.ingestCheckpoint.upsert({
    where: { collegeId: college.id },
    create: {
      collegeId: college.id,
      stage: "discover",
      status: "running",
      lockedAt: new Date(),
      lockOwner,
      lastProcessedUrl: null,
    },
    update: {
      stage: "discover",
      status: "running",
      lockedAt: new Date(),
      lockOwner,
      lastError: null,
    },
  });

  await prisma.college.update({
    where: { id: college.id },
    data: { lastCrawlAttemptAt: new Date() },
  });

  const domain = extractDomain(college.websiteUrl);
  const housingDomain = extractDomain(college.housingUrl);
  const allowedDomains = new Set(
    [domain, housingDomain].filter(Boolean).map((d) => d!.toLowerCase())
  );

  const isAllowedUrl = (url: string) => {
    const host = hostOf(url);
    if (!host) return false;
    for (const d of allowedDomains) {
      if (host === d || host.endsWith(`.${d}`)) return true;
    }
    return false;
  };

  const frontier: FrontierItem[] = [];
  const seen = new Set<string>();

  const enqueue = (url: string, depth: number) => {
    try {
      const abs = new URL(url).toString();
      if (seen.has(abs)) return;
      if (!isAllowedUrl(abs)) return;
      if (/instagram|facebook|twitter|linkedin|youtube|google\.com\/maps/i.test(abs)) return;
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

  if (college.websiteUrl && isAllowedUrl(college.websiteUrl)) {
    try {
      const releaseHome = await domainLimiter.acquire(hostOf(college.websiteUrl));
      try {
        const home = await fetchHtmlSafe(college.websiteUrl, { userAgent: UA });
        if (home.html) {
          const meta = parsePageMetadata(home.html, home.finalUrl);
          for (const link of meta.links) enqueue(link, 1);
          const homeHost = hostOf(home.finalUrl);
          if (homeHost) allowedDomains.add(homeHost);
        }
      } finally {
        releaseHome();
      }
    } catch (err) {
      await log("warn", `Homepage discovery failed: ${(err as Error).message}`);
    }
  }

  frontier.sort((a, b) => b.priority - a.priority);

  const uniqueEntityIds = new Set<string>();
  let acceptedCandidates = 0;
  let newEntitiesCreated = 0;
  let existingEntitiesUpdated = 0;
  let duplicatesSuppressed = 0;
  let rejectedCandidates = 0;
  let pagesVisited = 0;
  let directoryPagesVisited = 0;
  let detailPagesVisited = 0;
  let officialDirectorySourcesFound = 0;
  let unchangedPagesSkipped = 0;
  let bestHousingUrl: string | null = college.housingUrl;
  let blocked = false;
  let accessRestrictedHits = 0;
  let successfulFetches = 0;
  let lastHttpStatus: number | undefined;
  let housingSiteFound = Boolean(college.housingUrl);
  let directoryParsed = false;
  let hitPageBudget = false;

  const heartbeat = async (url?: string) => {
    await prisma.ingestCheckpoint.update({
      where: { collegeId: college.id },
      data: {
        lockedAt: new Date(),
        lastProcessedUrl: url ?? undefined,
        stage: "extract",
      },
    }).catch(() => undefined);
  };

  try {
    await log(
      "info",
      `Starting crawl for ${college.name} mode=${scrapeMode} frontier=${frontier.length}`
    );
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
        const release = await domainLimiter.acquire(hostOf(item.url));
        await heartbeat(item.url);

        let fetched;
        try {
          fetched = await fetchHtmlSafe(item.url, { userAgent: UA });
        } finally {
          release();
        }
        lastHttpStatus = fetched.status;

        // Access restrictions on a single URL: do not Playwright-bypass; do not whole-college block yet
        if (fetched.status === 403 || fetched.status === 401) {
          accessRestrictedHits += 1;
          await log("warn", `Access restricted HTTP ${fetched.status} (source-scoped)`, item.url);
          domainLimiter.backoff(hostOf(item.url), 60_000);
          continue;
        }
        if (fetched.status === 429) {
          const retryAfter = fetched.retryAfterMs ?? 30_000;
          domainLimiter.backoff(hostOf(item.url), retryAfter);
          await log("warn", `Rate limited HTTP 429 — cooldown ${retryAfter}ms`, item.url);
          continue;
        }
        if (fetched.status >= 500) {
          await log("warn", `Transient HTTP ${fetched.status}`, item.url);
          continue;
        }

        let html = fetched.html;
        let usedBrowser = false;

        // Short/empty HTML → Playwright if enabled
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
        successfulFetches += 1;

        // Content-hash skip for known unchanged sources
        if (!forceRefresh && fetched.contentHash) {
          const prior = await prisma.source.findFirst({
            where: {
              collegeId: college.id,
              OR: [{ url: item.url }, { finalUrl: fetched.finalUrl }],
              contentHash: fetched.contentHash,
              extractorVersion: EXTRACTOR_VERSION,
            },
          });
          if (prior) {
            unchangedPagesSkipped += 1;
            pagesVisited += 1;
            await log("info", `Unchanged content hash — skip re-extract`, item.url);
            continue;
          }
        }

        let parsed = parseHousingHtmlDetailed(html, fetched.finalUrl);

        // SPA shell: housing-looking page, few candidates, client-rendered signals → Playwright
        const looksHousing = parsed.pageRoles.some((r) =>
          ["housing_landing", "housing_directory", "housing_detail"].includes(r)
        );
        if (
          ENABLE_PLAYWRIGHT &&
          !usedBrowser &&
          looksHousing &&
          parsed.accepted.length === 0 &&
          parsed.spaSignals
        ) {
          await log("info", `SPA signals — Playwright render retry`, item.url);
          const pw = await fetchHtmlWithPlaywright(item.url);
          if (pw.html) {
            html = pw.html;
            fetched = { ...fetched, ...pw, contentHash: fetched.contentHash };
            usedBrowser = true;
            parsed = parseHousingHtmlDetailed(html, fetched.finalUrl);
          }
        }

        pagesVisited += 1;
        const meta = parsePageMetadata(html, fetched.finalUrl);
        const finalHost = hostOf(fetched.finalUrl);
        if (finalHost && isOfficialDomain(fetched.finalUrl, domain || finalHost)) {
          allowedDomains.add(finalHost);
        }

        const isDirectory = parsed.pageRoles.includes("housing_directory");
        const isDetail = parsed.pageRoles.includes("housing_detail");
        if (isDirectory) {
          directoryPagesVisited += 1;
          officialDirectorySourcesFound += 1;
          directoryParsed = true;
        }
        if (isDetail) detailPagesVisited += 1;
        if (looksHousing) housingSiteFound = true;

        // Discovery mode: stop after identifying housing sources/directories
        if (scrapeMode === "discovery" && (housingSiteFound || officialDirectorySourcesFound > 0)) {
          bestHousingUrl = bestHousingUrl ?? fetched.finalUrl;
          await upsertPageSource({
            collegeId: college.id,
            url: item.url,
            finalUrl: fetched.finalUrl,
            title: `${college.name} housing page`,
            sourceType: SourceType.OFFICIAL_WEBSITE,
            confidence: sourceConfidence(SourceType.OFFICIAL_WEBSITE),
            isApproved: true,
            rawSnippet: html.slice(0, 2000),
            contentHash: fetched.contentHash,
            httpStatus: fetched.status,
            extractorVersion: EXTRACTOR_VERSION,
            pageRole: parsed.pageRoles.join(","),
          });
          await log("info", `Discovery mode — housing source recorded`, item.url);
          break;
        }

        if (parsed.pageRoles.some((r) => r !== "irrelevant") && item.depth < 3) {
          for (const link of meta.links.slice(0, 25)) {
            enqueue(link, item.depth + 1);
          }
        }

        rejectedCandidates += parsed.rejected.length;

        if (parsed.accepted.length === 0) {
          await log(
            "warn",
            `No accepted housing candidates (${parsed.rejected.length} rejected)`,
            item.url
          );
          continue;
        }

        if (!bestHousingUrl || parsed.accepted.length >= 3) {
          bestHousingUrl = fetched.finalUrl;
        }

        const pageTitle =
          meta.title?.trim() ||
          `${college.name} — ${parsed.pageRoles[0] ?? "housing"}`;
        const roleLabel = parsed.pageRoles.includes("housing_directory")
          ? "directory"
          : parsed.pageRoles.includes("housing_detail")
            ? "detail"
            : parsed.pageRoles.includes("rates")
              ? "rates"
              : parsed.pageRoles[0] ?? "housing";

        const official = domain ? isOfficialDomain(fetched.finalUrl, domain) : isAllowedUrl(fetched.finalUrl);
        const source = await upsertPageSource({
          collegeId: college.id,
          url: item.url,
          finalUrl: fetched.finalUrl,
          title: pageTitle.slice(0, 200),
          sourceType: official ? SourceType.OFFICIAL_WEBSITE : SourceType.OTHER,
          confidence: sourceConfidence(SourceType.OFFICIAL_WEBSITE),
          isApproved: official,
          rawSnippet: html.slice(0, 2000),
          contentHash: fetched.contentHash,
          httpStatus: fetched.status,
          extractorVersion: EXTRACTOR_VERSION,
          pageRole: roleLabel,
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
              metadata: rej.classification.metadata
                ? (JSON.parse(JSON.stringify(rej.classification.metadata)) as object)
                : undefined,
            },
          });
        }

        await log(
          "info",
          `Accepted ${parsed.accepted.length} / rejected ${parsed.rejected.length} via ${usedBrowser ? "playwright" : "cheerio"}`,
          item.url
        );

        acceptedCandidates += parsed.accepted.length;

        for (const ex of parsed.accepted) {
          // Detail enrichment: merge page-level facts into candidate when on detail page
          if (isDetail && html) {
            const facts = extractDetailFacts(html, fetched.finalUrl);
            if (facts.hasAC != null) {
              if (facts.hasAC) ex.amenities = [...new Set([...ex.amenities, "ac"])];
              else ex.amenities = [...new Set([...ex.amenities.filter((a) => a !== "ac"), "no_ac"])];
            }
            if (facts.elevatorAccess === false) ex.amenities = [...new Set([...ex.amenities, "no_elevator"])];
            if (facts.elevatorAccess === true) ex.amenities = [...new Set([...ex.amenities, "elevator"])];
            if (facts.kitchenAccess === false) ex.amenities = [...new Set([...ex.amenities, "no_kitchen"])];
            if (facts.kitchenAccess === true) ex.amenities = [...new Set([...ex.amenities, "kitchen"])];
            if (facts.laundryAccess === false) ex.amenities = [...new Set([...ex.amenities, "no_laundry"])];
            if (facts.laundryAccess === true) ex.amenities = [...new Set([...ex.amenities, "laundry"])];
            if (facts.yearlyCost != null) {
              ex.costs.push({
                label: "Housing cost",
                amount: facts.yearlyCost,
                period: "yearly",
                uncertain: false,
              });
            }
            if (facts.imageUrl && !ex.imageUrl) ex.imageUrl = facts.imageUrl;
            if (facts.amenities.includes("study_lounge")) {
              ex.amenities = [...new Set([...ex.amenities, "study_lounge"])];
            }
          }

          const result = await persistExtractedDorm(ex, {
            collegeId: college.id,
            sourceUrl: fetched.finalUrl,
            sourceId: source.id,
            isOfficial: official,
          });
          if (!result) {
            duplicatesSuppressed += 1;
            continue;
          }
          if (uniqueEntityIds.has(result.dormId)) {
            duplicatesSuppressed += 1;
          } else {
            uniqueEntityIds.add(result.dormId);
          }
          if (result.created) newEntitiesCreated += 1;
          else existingEntitiesUpdated += 1;

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
              metadata: ex.classification?.metadata
                ? (JSON.parse(JSON.stringify(ex.classification.metadata)) as object)
                : undefined,
            },
          });
        }
      } catch (err) {
        const msg =
          err instanceof SafeUrlError
            ? `SSRF blocked: ${err.message}`
            : `Failed ${item.url}: ${(err as Error).message}`;
        await log("error", msg, item.url);
      }
    }

    hitPageBudget = pagesVisited >= MAX_PAGES && frontier.length > 0;
    // Whole-college BLOCKED only when meaningful discovery was prevented across viable sources
    blocked =
      successfulFetches === 0 &&
      accessRestrictedHits > 0 &&
      uniqueEntityIds.size === 0;
    const unresolvedHousingLinks = frontier.filter((f) => scoreUrl(f.url, bestHousingUrl) >= 40).length;

    const uniqueEntitiesSeenThisRun = uniqueEntityIds.size;
    const coverage = decideHousingCoverage({
      acceptedCandidates,
      newEntitiesCreated,
      existingEntitiesUpdated,
      uniqueEntitiesSeenThisRun,
      duplicatesSuppressed,
      rejectedCandidates,
      pagesVisited,
      directoryPagesVisited,
      detailPagesVisited,
      unresolvedHousingLinks,
      officialDirectorySourcesFound,
      unchangedPagesSkipped,
      blocked,
      lastHttpStatus,
      hasResidentialHousing: college.hasResidentialHousing,
      unresolvedHighPriorityDirectoryLinks: unresolvedHousingLinks,
      hitPageBudget,
      housingSiteFound,
      directoryParsed,
    });

    const inventorySuccess = uniqueEntitiesSeenThisRun > 0;
    const discoverySuccess = housingSiteFound || officialDirectorySourcesFound > 0;

    // Hierarchy enrichment after inventory extract
    if (inventorySuccess && scrapeMode !== "discovery") {
      try {
        const hier = await enrichCollegeHierarchy(college.id, { applyMedium: true });
        await log("info", `Hierarchy linked=${hier.linked} suggested=${hier.suggested}`);
      } catch (err) {
        await log("warn", `Hierarchy enrichment failed: ${(err as Error).message}`);
      }
    }

    await prisma.college.update({
      where: { id: college.id },
      data: {
        housingCoverageStatus: coverage,
        ...(bestHousingUrl ? { housingUrl: bestHousingUrl } : {}),
        ...(inventorySuccess ? { hasResidentialHousing: true } : {}),
        lastCrawlAttemptAt: new Date(),
        ...(discoverySuccess ? { lastDiscoverySuccessAt: new Date() } : {}),
        ...(inventorySuccess
          ? { lastInventorySuccessAt: new Date(), dataFreshnessAt: new Date() }
          : {}),
        lastUpdatedAt: new Date(),
      },
    });

    await prisma.ingestCheckpoint.update({
      where: { collegeId: college.id },
      data: {
        stage:
          coverage === HousingCoverageStatus.COMPLETE
            ? "complete"
            : inventorySuccess
              ? "enrich"
              : discoverySuccess
                ? "directory"
                : "discover",
        status:
          coverage === HousingCoverageStatus.BLOCKED
            ? "blocked"
            : coverage === HousingCoverageStatus.RETRYABLE
              ? "retryable"
              : coverage === HousingCoverageStatus.COMPLETE
                ? "complete"
                : inventorySuccess
                  ? "partial"
                  : "retryable",
        pagesVisited,
        candidateUrls: Array.from(seen).slice(0, 50),
        lastHttpStatus: lastHttpStatus ?? null,
        lastSuccessAt: inventorySuccess || discoverySuccess ? new Date() : undefined,
        lockedAt: null,
        lockOwner: null,
        failureClass: blocked
          ? "access_restricted"
          : uniqueEntitiesSeenThisRun === 0
            ? "empty_extraction"
            : null,
        metadata: {
          coverageDecision: coverage,
          directoryExhausted: coverage === HousingCoverageStatus.COMPLETE,
          uniqueEntitiesSeenThisRun,
          newEntitiesCreated,
          existingEntitiesUpdated,
          acceptedCandidates,
          rejectedCandidates,
          duplicatesSuppressed,
          officialDirectorySourcesFound,
          unresolvedHousingLinks,
          hitPageBudget,
        },
      },
    });

    await prisma.scrapeJob.update({
      where: { id: job.id },
      data: {
        status: ScrapeJobStatus.COMPLETED,
        completedAt: new Date(),
        candidateUrls: Array.from(seen).slice(0, 40),
        dormsFound: uniqueEntitiesSeenThisRun,
        stage: "complete",
      },
    });

    await log(
      "info",
      `Completed. unique=${uniqueEntitiesSeenThisRun} created=${newEntitiesCreated} updated=${existingEntitiesUpdated} rejected=${rejectedCandidates} pages=${pagesVisited} coverage=${coverage}`
    );

    return {
      jobId: job.id,
      acceptedCandidates,
      newEntitiesCreated,
      existingEntitiesUpdated,
      uniqueEntitiesSeenThisRun,
      duplicatesSuppressed,
      rejectedCandidates,
      pagesVisited,
      directoryPagesVisited,
      detailPagesVisited,
      unresolvedHousingLinks,
      officialDirectorySourcesFound,
      unchangedPagesSkipped,
      dormsFound: uniqueEntitiesSeenThisRun,
      housingUrl: bestHousingUrl,
      coverage,
    };
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
    await prisma.college.update({
      where: { id: college.id },
      data: { lastCrawlAttemptAt: new Date() },
    });
    await log("error", (err as Error).message);
    throw err;
  } finally {
    await closeSharedBrowser().catch(() => undefined);
  }
}
