/**
 * Quarantine low-confidence junk housing rows (never hard-delete).
 *
 * Usage:
 *   DATABASE_URL=... npm run quarantine:junk --workspace=@dormscope/database
 *   APPLY=1 DATABASE_URL=... npm run quarantine:junk --workspace=@dormscope/database
 */
import { createScriptPrisma, isApplyMode, printModeBanner } from "./lib/script-utils";
import { findJunkCandidates } from "./lib/find-junk-candidates";

const ACTOR = process.env.QUARANTINE_ACTOR ?? "cleanup-junk-housing";

async function main() {
  const apply = isApplyMode();
  printModeBanner(apply);
  const prisma = createScriptPrisma();

  try {
    const candidates = await findJunkCandidates(prisma);
    const byReason: Record<string, number> = {};
    const byCollege: Record<string, { college: string; count: number; samples: string[] }> = {};

    for (const c of candidates) {
      byReason[c.reason] = (byReason[c.reason] ?? 0) + 1;
      if (!byCollege[c.collegeSlug]) {
        byCollege[c.collegeSlug] = { college: c.collegeName, count: 0, samples: [] };
      }
      byCollege[c.collegeSlug].count += 1;
      if (byCollege[c.collegeSlug].samples.length < 3) {
        byCollege[c.collegeSlug].samples.push(c.name);
      }
    }

    let quarantined = 0;
    if (apply) {
      const now = new Date();
      for (const c of candidates) {
        await prisma.dorm.update({
          where: { id: c.id },
          data: {
            isActive: false,
            dataQualityStatus: "QUARANTINED",
            quarantineReason: c.reason,
            quarantinedAt: now,
            quarantinedBy: ACTOR,
          },
        });
        quarantined += 1;
      }
    }

    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry_run",
          scannedCandidates: candidates.length,
          quarantined: apply ? quarantined : 0,
          byReason,
          byCollege: Object.entries(byCollege)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 20)
            .map(([slug, row]) => ({ slug, ...row })),
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
