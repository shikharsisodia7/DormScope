/**
 * Ingest dorm hall names from official public housing pages for a cross-section
 * of colleges. Only persists confidently extracted names — never fabricates
 * amenities or costs.
 *
 * Usage: npm run ingest:sample --workspace=@dormscope/scraper
 */
import { prisma, HousingCoverageStatus } from "@dormscope/database";
import { runScraperForCollege } from "../src/jobs/runScraper.js";

const TARGETS: Array<{
  slugHints: string[];
  nameHints: string[];
  housingUrl: string;
}> = [
  {
    slugHints: ["santa-clara-university", "santa-clara"],
    nameHints: ["Santa Clara University", "Santa Clara"],
    housingUrl: "https://www.scu.edu/living/",
  },
  {
    slugHints: ["university-of-michigan", "university-of-michigan-ann-arbor"],
    nameHints: ["University of Michigan"],
    housingUrl: "https://housing.umich.edu/",
  },
  {
    slugHints: ["university-of-texas-at-austin", "the-university-of-texas-at-austin"],
    nameHints: ["University of Texas at Austin", "The University of Texas at Austin"],
    housingUrl: "https://housing.utexas.edu/",
  },
  {
    slugHints: ["boston-university"],
    nameHints: ["Boston University"],
    housingUrl: "https://www.bu.edu/housing/",
  },
  {
    slugHints: ["university-of-florida"],
    nameHints: ["University of Florida"],
    housingUrl: "https://www.housing.ufl.edu/",
  },
];

async function findCollege(slugHints: string[], nameHints: string[]) {
  for (const slug of slugHints) {
    const bySlug = await prisma.college.findUnique({ where: { slug } });
    if (bySlug) return bySlug;
  }
  for (const name of nameHints) {
    const byName = await prisma.college.findFirst({
      where: { name: { contains: name, mode: "insensitive" } },
    });
    if (byName) return byName;
  }
  for (const name of nameHints) {
    const byAlias = await prisma.college.findFirst({
      where: { aliases: { some: { alias: { contains: name, mode: "insensitive" } } } },
    });
    if (byAlias) return byAlias;
  }
  return null;
}

async function findSmallCollege() {
  return prisma.college.findFirst({
    where: {
      OR: [
        { studentPopulation: { lt: 5000, gt: 500 } },
        { housingCoverageStatus: HousingCoverageStatus.UNKNOWN },
      ],
      AND: [
        {
          OR: [
            { housingUrl: { not: null } },
            { websiteUrl: { not: null } },
          ],
        },
      ],
    },
    orderBy: { studentPopulation: "asc" },
  });
}

async function ensureHousingUrl(collegeId: string, housingUrl: string) {
  const college = await prisma.college.findUnique({ where: { id: collegeId } });
  if (!college) return;
  if (!college.housingUrl) {
    await prisma.college.update({
      where: { id: collegeId },
      data: {
        housingUrl,
        housingCoverageStatus: HousingCoverageStatus.DISCOVERY_PENDING,
      },
    });
    console.log(`  set housingUrl → ${housingUrl}`);
  }
}

async function main() {
  const results: Array<{ slug: string; dormsFound: number | string; status: string }> = [];

  for (const target of TARGETS) {
    const college = await findCollege(target.slugHints, target.nameHints);
    if (!college) {
      console.log(`SKIP (not in DB): ${target.nameHints[0]}`);
      results.push({ slug: target.slugHints[0], dormsFound: 0, status: "missing_college" });
      continue;
    }

    console.log(`\n=== ${college.name} (${college.slug}) ===`);
    await ensureHousingUrl(college.id, target.housingUrl);

    try {
      const r = await runScraperForCollege(college.slug);
      console.log(`  dormsFound=${r.dormsFound}`);
      results.push({ slug: college.slug, dormsFound: r.dormsFound, status: "ok" });
    } catch (err) {
      console.error(`  ERROR: ${(err as Error).message}`);
      results.push({ slug: college.slug, dormsFound: 0, status: "error" });
    }
  }

  const small = await findSmallCollege();
  if (small) {
    console.log(`\n=== Small college: ${small.name} (${small.slug}) ===`);
    if (small.housingUrl || small.websiteUrl) {
      try {
        const r = await runScraperForCollege(small.slug);
        console.log(`  dormsFound=${r.dormsFound}`);
        results.push({ slug: small.slug, dormsFound: r.dormsFound, status: "ok_small" });
      } catch (err) {
        console.error(`  ERROR: ${(err as Error).message}`);
        results.push({ slug: small.slug, dormsFound: 0, status: "error_small" });
      }
    } else {
      console.log("  no housing/website URL — left empty honestly");
      results.push({ slug: small.slug, dormsFound: 0, status: "no_url" });
    }
  } else {
    console.log("\nNo small college candidate found in DB.");
  }

  console.log("\n--- Summary ---");
  console.table(results);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
