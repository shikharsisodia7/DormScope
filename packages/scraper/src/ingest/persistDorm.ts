import { prisma, SourceType, HousingEntityKind } from "@dormscope/database";
import { slugify, fuzzyDormNameMatch } from "@dormscope/shared";
import { computeDormScore } from "@dormscope/scoring";
import type { ExtractedDorm } from "../html/parsePage.js";
import { sourceConfidence, completenessScore } from "../confidence/score.js";
import { canonicalizeUrl } from "../security/ssrf.js";

export interface PersistOptions {
  collegeId: string;
  sourceUrl: string;
  sourceId: string;
  isOfficial: boolean;
}

const KIND_MAP: Record<string, HousingEntityKind> = {
  COMPLEX: HousingEntityKind.COMPLEX,
  RESIDENTIAL_COLLEGE: HousingEntityKind.RESIDENTIAL_COLLEGE,
  VILLAGE: HousingEntityKind.VILLAGE,
  UNIT: HousingEntityKind.UNIT,
  BUILDING: HousingEntityKind.BUILDING,
  HOUSE: HousingEntityKind.HOUSE,
  APARTMENT_COMMUNITY: HousingEntityKind.APARTMENT_COMMUNITY,
  SUITE_COMMUNITY: HousingEntityKind.SUITE_COMMUNITY,
  LIVING_COMMUNITY: HousingEntityKind.LIVING_COMMUNITY,
  RESIDENCE: HousingEntityKind.RESIDENCE,
  OTHER: HousingEntityKind.OTHER,
  UNKNOWN: HousingEntityKind.UNKNOWN,
};

/**
 * Safer entity resolution: exact slug / exact alias merge automatically.
 * High fuzzy scores that preserve meaningful numbers/directions only merge
 * when normalized tokens match closely; otherwise skip (no destructive merge).
 */
function safeSameEntity(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\b(the|residence|hall|dormitory|dorm|building|community)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Never merge Unit 1 with Unit 2, North with South, etc.
  const numsA = na.match(/\d+/g)?.join(",") ?? "";
  const numsB = nb.match(/\d+/g)?.join(",") ?? "";
  if (numsA !== numsB) return false;
  const dirs = ["north", "south", "east", "west", "upper", "lower"];
  for (const d of dirs) {
    if (na.includes(d) !== nb.includes(d)) return false;
  }
  return fuzzyDormNameMatch(a, b) >= 0.92;
}

/**
 * Persist only confidently extracted housing entities. Unknown fields stay null.
 * Scraped dorms are always isVerified: false. Directory sources link via DormSource.
 */
export async function persistExtractedDorm(
  ex: ExtractedDorm,
  opts: PersistOptions
): Promise<{ dormId: string; created: boolean } | null> {
  const name = ex.name?.trim();
  if (!name || name.length < 2) return null;

  const dormSlug = slugify(name);
  if (!dormSlug) return null;

  const candidates = await prisma.dorm.findMany({
    where: { collegeId: opts.collegeId },
    select: { id: true, name: true, slug: true, aliases: { select: { alias: true } } },
  });

  let existing: (typeof candidates)[number] | undefined;
  for (const c of candidates) {
    if (c.slug === dormSlug) {
      existing = c;
      break;
    }
    if (c.aliases.some((a) => slugify(a.alias) === dormSlug || a.alias.toLowerCase() === name.toLowerCase())) {
      existing = c;
      break;
    }
    if (safeSameEntity(c.name, name)) {
      existing = c;
      break;
    }
  }

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

  const entityKind = KIND_MAP[ex.entityKindHint ?? ""] ?? HousingEntityKind.UNKNOWN;

  const baseData = {
    name,
    collegeId: opts.collegeId,
    officialHousingUrl: ex.detailUrl ?? opts.sourceUrl,
    confidenceScore: confidence,
    dataCompletenessScore,
    isVerified: false as const,
    lastUpdatedAt: new Date(),
    entityKind,
    isAssignableHousingOption: true,
    rankingGranularity: true,
    // Eligibility stays unknown unless explicitly extracted (never default true)
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
          freshmanEligible: null,
          upperclassEligible: null,
          honorsHousing: null,
          themedHousing: null,
          genderInclusive: null,
          hasAC: hasAC ?? null,
          laundryAccess: laundryAccess ?? null,
          kitchenAccess: kitchenAccess ?? null,
          studyLounges: studyLounges ?? null,
          yearlyCost: yearlyCost ?? null,
        },
      });

  // Link source without overwriting Source.dormId for multi-entity directories
  await prisma.dormSource.upsert({
    where: { dormId_sourceId: { dormId: dorm.id, sourceId: opts.sourceId } },
    create: {
      dormId: dorm.id,
      sourceId: opts.sourceId,
      role: ex.detailUrl && ex.detailUrl !== opts.sourceUrl ? "detail" : "directory",
    },
    update: {},
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

  const fields: Array<{ fieldName: string; value: string | null }> = [
    { fieldName: "name", value: name },
    { fieldName: "officialHousingUrl", value: ex.detailUrl ?? opts.sourceUrl },
    { fieldName: "yearlyCost", value: yearlyCost != null ? String(yearlyCost) : null },
    { fieldName: "hasAC", value: hasAC ? "true" : null },
    { fieldName: "laundryAccess", value: laundryAccess ? "true" : null },
    { fieldName: "kitchenAccess", value: kitchenAccess ? "true" : null },
    { fieldName: "studyLounges", value: studyLounges ? "true" : null },
    { fieldName: "imageUrl", value: ex.imageUrl ?? null },
    { fieldName: "entityKind", value: entityKind },
  ];

  for (const f of fields) {
    if (f.value == null) continue;
    const recent = await prisma.fieldProvenance.findFirst({
      where: { dormId: dorm.id, fieldName: f.fieldName, valueSnapshot: f.value },
      orderBy: { createdAt: "desc" },
    });
    if (recent) continue;
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

  return { dormId: dorm.id, created: !existing };
}

export async function upsertPageSource(input: {
  collegeId: string;
  url: string;
  finalUrl?: string;
  title?: string;
  sourceType?: SourceType;
  confidence?: number;
  isApproved?: boolean;
  rawSnippet?: string;
  contentHash?: string;
  httpStatus?: number;
  extractorVersion?: string;
  pageRole?: string;
}) {
  const canonicalUrl = canonicalizeUrl(input.finalUrl ?? input.url);
  return prisma.source.upsert({
    where: {
      collegeId_canonicalUrl: {
        collegeId: input.collegeId,
        canonicalUrl,
      },
    },
    create: {
      collegeId: input.collegeId,
      url: input.url,
      canonicalUrl,
      finalUrl: input.finalUrl ?? input.url,
      title: input.title,
      sourceType: input.sourceType ?? SourceType.OFFICIAL_WEBSITE,
      confidence: input.confidence ?? 0.7,
      scrapedAt: new Date(),
      isApproved: input.isApproved ?? false,
      rawSnippet: input.rawSnippet,
      contentHash: input.contentHash,
      httpStatus: input.httpStatus,
      extractorVersion: input.extractorVersion ?? "parseHousingHtmlDetailed@2",
      pageRole: input.pageRole,
    },
    update: {
      scrapedAt: new Date(),
      finalUrl: input.finalUrl ?? input.url,
      rawSnippet: input.rawSnippet,
      contentHash: input.contentHash,
      httpStatus: input.httpStatus,
      title: input.title,
      pageRole: input.pageRole,
      extractorVersion: input.extractorVersion ?? "parseHousingHtmlDetailed@2",
    },
  });
}
