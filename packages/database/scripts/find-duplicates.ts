/**
 * Flag similar dorm names within the same college as DUPLICATE.
 *
 * Usage:
 *   DATABASE_URL=... npm run find:duplicates --workspace=@dormscope/database
 *   APPLY=1 DATABASE_URL=... npm run find:duplicates --workspace=@dormscope/database
 */
import { fuzzyDormNameMatch } from "@dormscope/shared";
import { createScriptPrisma, isApplyMode, printModeBanner } from "./lib/script-utils";

const ACTOR = process.env.QUARANTINE_ACTOR ?? "find-duplicates";
const MATCH_THRESHOLD = Number(process.env.DUPLICATE_THRESHOLD ?? "0.85");

async function main() {
  const apply = isApplyMode();
  printModeBanner(apply);
  const prisma = createScriptPrisma();

  try {
    const dorms = await prisma.dorm.findMany({
      where: {
        isActive: true,
        dataQualityStatus: { in: ["ACTIVE", "REVIEW"] },
      },
      select: { id: true, name: true, collegeId: true, college: { select: { name: true, slug: true } } },
      orderBy: [{ collegeId: "asc" }, { name: "asc" }],
    });

    const byCollege = new Map<string, typeof dorms>();
    for (const d of dorms) {
      const list = byCollege.get(d.collegeId) ?? [];
      list.push(d);
      byCollege.set(d.collegeId, list);
    }

    const pairs: Array<{
      college: string;
      slug: string;
      a: { id: string; name: string };
      b: { id: string; name: string };
      score: number;
    }> = [];

    for (const [, list] of byCollege) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const score = fuzzyDormNameMatch(list[i].name, list[j].name);
          if (score >= MATCH_THRESHOLD && score < 1) {
            pairs.push({
              college: list[i].college.name,
              slug: list[i].college.slug,
              a: { id: list[i].id, name: list[i].name },
              b: { id: list[j].id, name: list[j].name },
              score,
            });
          }
        }
      }
    }

    pairs.sort((a, b) => b.score - a.score);

    let flagged = 0;
    if (apply) {
      const now = new Date();
      const flaggedIds = new Set<string>();
      for (const p of pairs) {
        for (const target of [p.a, p.b]) {
          if (flaggedIds.has(target.id)) continue;
          await prisma.dorm.update({
            where: { id: target.id },
            data: {
              dataQualityStatus: "DUPLICATE",
              isActive: false,
              quarantineReason: `duplicate_of:${p.a.id === target.id ? p.b.name : p.a.name}`,
              quarantinedAt: now,
              quarantinedBy: ACTOR,
            },
          });
          flaggedIds.add(target.id);
          flagged += 1;
        }
      }
    }

    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry_run",
          collegesScanned: byCollege.size,
          duplicatePairs: pairs.length,
          flagged: apply ? flagged : 0,
          samples: pairs.slice(0, 30),
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
