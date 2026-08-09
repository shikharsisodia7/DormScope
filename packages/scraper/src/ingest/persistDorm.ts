import { prisma, SourceType } from "@dormscope/database";
import { slugify, fuzzyDormNameMatch } from "@dormscope/shared";
import { computeDormScore } from "@dormscope/scoring";
import type { ExtractedDorm } from "../html/parsePage.js";
import { sourceConfidence, completenessScore } from "../confidence/score.js";

export interface PersistOptions {
  collegeId: string;
  sourceUrl: string;
  sourceId: string;
  isOfficial: boolean;
}

/**
 * Persist only confidently extracted hall names. Never invent amenities/costs —
 * unknown fields stay null. Scraped dorms are always isVerified: false.
 */
export async function persistExtractedDorm(
  ex: ExtractedDorm,
  opts: PersistOptions
): Promise<{ dormId: string; created: boolean } | null> {
  const name = ex.name?.trim();
  if (!name || name.length < 3) return null;

  const dormSlug = slugify(name);
  if (!dormSlug) return null;

  const candidates = await prisma.dorm.findMany({
    where: { collegeId: opts.collegeId },
    select: { id: true, name: true, slug: true },
  });

  let existing: (typeof candidates)[number] | undefined;
  for (const c of candidates) {
    if (c.slug === dormSlug || fuzzyDormNameMatch(c.name, name) >= 0.7) {
      existing = c;
      break;
    }
  }

  // Only set boolean amenities when explicitly detected; unknown stays unset/null
  const hasAC = ex.amenities.includes("ac") ? true : undefined;
  const laundryAccess = ex.amenities.includes("laundry") ? true : undefined;
  const kitchenAccess = ex.amenities.includes("kitchen") ? true : undefined;
  const studyLounges = ex.amenities.includes("study_lounge") ? true : undefined;

  const yearlyCost =
    ex.costs.find((c) => c.period === "yearly" || c.period === "room_board")?.amount ?? undefined;

  const confidence = sourceConfidence(
    opts.isOfficial ? SourceType.OFFICIAL_WEBSITE : SourceType.OTHER
  );
  const dataCompletenessScore = completenessScore({
    name,
    yearlyCost,
    amenities: ex.amenities.length,
  });

  const baseData = {
    name,
    collegeId: opts.collegeId,
    officialHousingUrl: opts.sourceUrl,
    confidenceScore: confidence,
    dataCompletenessScore,
    isVerified: false as const,
    lastUpdatedAt: new Date(),
    ...(ex.imageUrl ? { imageUrl: ex.imageUrl } : {}),
    ...(yearlyCost != null ? { yearlyCost } : {}),
    ...(ex.description ? { description: ex.description } : {}),
    ...(hasAC ? { hasAC } : {}),
    ...(laundryAccess ? { laundryAccess } : {}),
    ...(kitchenAccess ? { kitchenAccess } : {}),
    ...(studyLounges ? { studyLounges } : {}),
  };

  const dorm = existing
    ? await prisma.dorm.update({
        where: { id: existing.id },
        data: baseData,
      })
    : await prisma.dorm.create({
        data: {
          ...baseData,
          slug: dormSlug,
          // Explicit nulls on create for unknown amenities/costs
          hasAC: hasAC ?? null,
          laundryAccess: laundryAccess ?? null,
          kitchenAccess: kitchenAccess ?? null,
          studyLounges: studyLounges ?? null,
          yearlyCost: yearlyCost ?? null,
        },
      });

  const scores = computeDormScore({
    yearlyCost: yearlyCost ?? null,
    collegeAvgCost: null,
    hasAC: hasAC ?? null,
    amenityCount: ex.amenities.length || null,
    confidenceScore: confidence,
  });

  const persisted = {
    overallScore: scores.overallScore,
    valueScore: scores.valueScore ?? 0,
    comfortScore: scores.comfortScore ?? 0,
    privacyScore: scores.privacyScore ?? 0,
    socialScore: scores.socialScore ?? 0,
    convenienceScore: scores.convenienceScore ?? 0,
    freshmanFitScore: scores.freshmanFitScore ?? 0,
    amenityScore: scores.amenityScore ?? 0,
    dataConfidenceScore: scores.dataConfidenceScore ?? 0,
    breakdown: { ...scores.breakdown, completeness: scores.completeness },
  };

  await prisma.dormScore.upsert({
    where: { dormId: dorm.id },
    create: { dormId: dorm.id, ...persisted },
    update: { ...persisted, calculatedAt: new Date() },
  });

  // Field provenance for written fields only
  const fields: Array<{ fieldName: string; value: string | null }> = [
    { fieldName: "name", value: name },
    { fieldName: "officialHousingUrl", value: opts.sourceUrl },
    { fieldName: "yearlyCost", value: yearlyCost != null ? String(yearlyCost) : null },
    { fieldName: "hasAC", value: hasAC ? "true" : null },
    { fieldName: "laundryAccess", value: laundryAccess ? "true" : null },
    { fieldName: "kitchenAccess", value: kitchenAccess ? "true" : null },
    { fieldName: "studyLounges", value: studyLounges ? "true" : null },
    { fieldName: "imageUrl", value: ex.imageUrl ?? null },
  ];

  for (const f of fields) {
    if (f.value == null) continue;
    await prisma.fieldProvenance.create({
      data: {
        dormId: dorm.id,
        collegeId: opts.collegeId,
        fieldName: f.fieldName,
        valueSnapshot: f.value,
        sourceId: opts.sourceId,
        sourceUrl: opts.sourceUrl,
        confidence,
        verified: false,
      },
    });
  }

  await prisma.source.update({
    where: { id: opts.sourceId },
    data: { dormId: dorm.id },
  }).catch(() => undefined);

  return { dormId: dorm.id, created: !existing };
}
