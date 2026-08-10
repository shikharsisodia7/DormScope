/**
 * APPLY=1 SLUGS=a,b npm run hierarchy:enrich --workspace=@dormscope/scraper
 */
import { prisma } from "@dormscope/database";
import { enrichAllHierarchy } from "../src/enrich/hierarchy.js";

const APPLY = process.env.APPLY === "1";
const SLUGS = (process.env.SLUGS ??
  "university-of-california-berkeley,stanford-university,university-of-california-los-angeles,santa-clara-university,purdue-university-main-campus,ohio-state-university-main-campus,pennsylvania-state-university-main-campus,university-of-wisconsin-madison,university-of-washington-seattle-campus,georgia-institute-of-technology-main-campus,university-of-north-carolina-at-chapel-hill")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  console.log(APPLY ? "=== APPLY MODE ===" : "=== DRY RUN (APPLY=1 to write) ===");
  // Dry-run still computes suggestions via enrich with applyMedium=false for autoLink-only
  const results = await enrichAllHierarchy({
    collegeSlugs: SLUGS,
    applyMedium: APPLY,
  });
  // When dry-run, enrichCollegeHierarchy only autoLinks high confidence — for dry we want counts
  const linked = results.reduce((a, r) => a + r.linked, 0);
  const suggested = results.reduce((a, r) => a + r.suggested, 0);
  console.log(JSON.stringify({ apply: APPLY, linked, suggested, byCollege: results.filter((r) => r.suggested > 0) }, null, 2));

  const parents = await prisma.dorm.count({ where: { childHousing: { some: {} } } });
  const children = await prisma.dorm.count({ where: { parentHousingId: { not: null } } });
  console.log(JSON.stringify({ parentEntities: parents, childEntities: children }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
