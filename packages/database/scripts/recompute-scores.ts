/**
 * Recompute DormScore rows using algorithm v2 (nullable components, scoreable flag).
 *
 * Usage:
 *   DATABASE_URL=... npm run recompute:scores --workspace=@dormscope/database
 *   APPLY=1 DATABASE_URL=... npm run recompute:scores --workspace=@dormscope/database
 */
import { computeDormScore } from "@dormscope/scoring";
import { createScriptPrisma, isApplyMode, printModeBanner } from "./lib/script-utils";

async function main() {
  const apply = isApplyMode();
  printModeBanner(apply);
  const prisma = createScriptPrisma();

  try {
    const avgByCollege = await prisma.dorm.groupBy({
      by: ["collegeId"],
      where: { yearlyCost: { not: null } },
      _avg: { yearlyCost: true },
    });
    const collegeAvg = new Map(avgByCollege.map((r) => [r.collegeId, r._avg.yearlyCost ?? null]));

    const dorms = await prisma.dorm.findMany({
      where: { isActive: true, dataQualityStatus: "ACTIVE" },
      select: {
        id: true,
        collegeId: true,
        yearlyCost: true,
        hasAC: true,
        bathroomStyle: true,
        privacyRating: true,
        socialVibe: true,
        quietVibe: true,
        freshmanEligible: true,
        diningDistanceMeters: true,
        confidenceScore: true,
        dataCompletenessScore: true,
        _count: { select: { dormAmenities: true } },
      },
    });

    let updated = 0;
    let scoreable = 0;
    let unscoreable = 0;

    for (const d of dorms) {
      const scores = computeDormScore({
        yearlyCost: d.yearlyCost,
        collegeAvgCost: collegeAvg.get(d.collegeId) ?? null,
        hasAC: d.hasAC,
        bathroomStyle: d.bathroomStyle,
        privacyRating: d.privacyRating,
        socialVibe: d.socialVibe,
        quietVibe: d.quietVibe,
        freshmanEligible: d.freshmanEligible,
        amenityCount: d._count.dormAmenities || null,
        diningDistanceMeters: d.diningDistanceMeters,
        confidenceScore: d.confidenceScore,
        dataCompletenessScore: d.dataCompletenessScore,
      });

      if (scores.scoreable) scoreable += 1;
      else unscoreable += 1;

      if (apply) {
        await prisma.dormScore.upsert({
          where: { dormId: d.id },
          create: {
            dormId: d.id,
            overallScore: scores.overallScore,
            valueScore: scores.valueScore,
            comfortScore: scores.comfortScore,
            privacyScore: scores.privacyScore,
            socialScore: scores.socialScore,
            convenienceScore: scores.convenienceScore,
            freshmanFitScore: scores.freshmanFitScore,
            amenityScore: scores.amenityScore,
            dataConfidenceScore: scores.dataConfidenceScore,
            evidenceCompleteness: scores.completeness,
            scoreable: scores.scoreable,
            algorithmVersion: scores.algorithmVersion,
            breakdown: scores.breakdown,
          },
          update: {
            overallScore: scores.overallScore,
            valueScore: scores.valueScore,
            comfortScore: scores.comfortScore,
            privacyScore: scores.privacyScore,
            socialScore: scores.socialScore,
            convenienceScore: scores.convenienceScore,
            freshmanFitScore: scores.freshmanFitScore,
            amenityScore: scores.amenityScore,
            dataConfidenceScore: scores.dataConfidenceScore,
            evidenceCompleteness: scores.completeness,
            scoreable: scores.scoreable,
            algorithmVersion: scores.algorithmVersion,
            breakdown: scores.breakdown,
            calculatedAt: new Date(),
          },
        });
        updated += 1;
      }
    }

    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry_run",
          dorms: dorms.length,
          updated: apply ? updated : 0,
          scoreable,
          unscoreable,
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
