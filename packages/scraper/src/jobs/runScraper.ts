import { prisma, ScrapeJobStatus, SourceType } from "@dormscope/database";
import { slugify, fuzzyDormNameMatch } from "@dormscope/shared";
import { computeDormScore } from "@dormscope/scoring";
import { chromium } from "playwright";
import { parseHousingHtml } from "../html/parsePage.js";
import { housingSearchQueries, extractDomain, isOfficialDomain } from "../discovery/queries.js";
import { sourceConfidence, completenessScore } from "../confidence/score.js";

export async function runScraperForCollege(collegeSlug: string) {
  const college = await prisma.college.findUnique({ where: { slug: collegeSlug } });
  if (!college) throw new Error(`College not found: ${collegeSlug}`);

  const job = await prisma.scrapeJob.create({
    data: {
      collegeId: college.id,
      status: ScrapeJobStatus.RUNNING,
      startedAt: new Date(),
      candidateUrls: [],
    },
  });

  const log = async (level: string, message: string, url?: string) => {
    await prisma.scrapeLog.create({ data: { jobId: job.id, level, message, url } });
  };

  const candidateUrls: string[] = [];
  if (college.housingUrl) candidateUrls.push(college.housingUrl);
  if (college.websiteUrl) {
    housingSearchQueries(college.name).forEach(() => {});
    candidateUrls.push(`${college.websiteUrl.replace(/\/$/, "")}/housing`);
  }

  const domain = extractDomain(college.websiteUrl);
  let dormsFound = 0;

  try {
    await log("info", `Starting scrape for ${college.name}`);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
      "User-Agent": process.env.SCRAPER_USER_AGENT ?? "DormScopeBot/1.0",
    });

    for (const url of candidateUrls.slice(0, 3)) {
      try {
        await log("info", `Fetching ${url}`, url);
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await new Promise((r) => setTimeout(r, Number(process.env.SCRAPER_RATE_LIMIT_MS ?? 2000)));
        const html = await page.content();
        const extracted = parseHousingHtml(html, url);

        await prisma.source.create({
          data: {
            collegeId: college.id,
            url,
            title: `${college.name} housing page`,
            sourceType: isOfficialDomain(url, domain) ? SourceType.OFFICIAL_WEBSITE : SourceType.OTHER,
            confidence: sourceConfidence(SourceType.OFFICIAL_WEBSITE),
            scrapedAt: new Date(),
            isApproved: isOfficialDomain(url, domain),
            rawSnippet: html.slice(0, 2000),
          },
        });

        for (const ex of extracted) {
          const dormSlug = slugify(ex.name);
          const existing = await prisma.dorm.findFirst({
            where: { collegeId: college.id, name: { contains: ex.name.split(" ")[0], mode: "insensitive" } },
          });

          if (existing && fuzzyDormNameMatch(existing.name, ex.name) < 0.7) continue;

          const yearlyCost = ex.costs.find((c) => c.period === "yearly" || c.period === "room_board")?.amount;
          const data = {
            name: ex.name,
            slug: dormSlug,
            collegeId: college.id,
            officialHousingUrl: url,
            imageUrl: ex.imageUrl,
            yearlyCost,
            confidenceScore: sourceConfidence(SourceType.OFFICIAL_WEBSITE),
            dataCompletenessScore: completenessScore({
              name: ex.name,
              yearlyCost,
              amenities: ex.amenities.length,
            }),
            hasAC: ex.amenities.includes("ac") ? true : undefined,
            laundryAccess: ex.amenities.includes("laundry"),
            kitchenAccess: ex.amenities.includes("kitchen"),
            studyLounges: ex.amenities.includes("study_lounge"),
          };

          const dorm = existing
            ? await prisma.dorm.update({ where: { id: existing.id }, data: { ...data, lastUpdatedAt: new Date() } })
            : await prisma.dorm.create({ data });

          const avg = yearlyCost ?? 15000;
          const scores = computeDormScore({
            yearlyCost,
            collegeAvgCost: avg,
            hasAC: data.hasAC,
            amenityCount: ex.amenities.length,
            confidenceScore: data.confidenceScore,
          });

          await prisma.dormScore.upsert({
            where: { dormId: dorm.id },
            create: { dormId: dorm.id, ...scores, breakdown: scores.breakdown },
            update: { ...scores, breakdown: scores.breakdown, calculatedAt: new Date() },
          });

          dormsFound++;
        }
      } catch (err) {
        await log("error", `Failed ${url}: ${(err as Error).message}`, url);
      }
    }

    await browser.close();

    await prisma.scrapeJob.update({
      where: { id: job.id },
      data: {
        status: ScrapeJobStatus.COMPLETED,
        completedAt: new Date(),
        candidateUrls,
        dormsFound,
      },
    });

    await log("info", `Completed. ${dormsFound} dorms processed.`);
    return { jobId: job.id, dormsFound };
  } catch (err) {
    await prisma.scrapeJob.update({
      where: { id: job.id },
      data: { status: ScrapeJobStatus.FAILED, errorMessage: (err as Error).message, completedAt: new Date() },
    });
    await log("error", (err as Error).message);
    throw err;
  }
}
