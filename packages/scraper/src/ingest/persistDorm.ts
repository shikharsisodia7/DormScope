import { prisma, SourceType, HousingEntityKind } from "@dormscope/database";
import { slugify, normalizeAC } from "@dormscope/shared";
import { computeDormScore, DORMSCOPE_SCORE_VERSION } from "@dormscope/scoring";
import type { ExtractedDorm } from "../html/parsePage.js";
import { sourceConfidence, completenessScore } from "../confidence/score.js";
import { canonicalizeUrl } from "../security/ssrf.js";
import { safeSameEntity } from "./entityResolution.js";

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

const ASSIGNABLE_KINDS = new Set<HousingEntityKind>([
  HousingEntityKind.UNIT,
  HousingEntityKind.APARTMENT_COMMUNITY,
  HousingEntityKind.HOUSE,
  HousingEntityKind.BUILDING,
  HousingEntityKind.RESIDENCE,
  HousingEntityKind.SUITE_COMMUNITY,
  HousingEntityKind.LIVING_COMMUNITY,
]);

const ORGANIZATIONAL_KINDS = new Set<HousingEntityKind>([
  HousingEntityKind.COMPLEX,
  HousingEntityKind.VILLAGE,
  HousingEntityKind.RESIDENTIAL_COLLEGE,
]);

const PHYSICAL_KINDS = new Set<HousingEntityKind>([
  HousingEntityKind.BUILDING,
  HousingEntityKind.HOUSE,
  HousingEntityKind.UNIT,
  HousingEntityKind.RESIDENCE,
]);

function inferHousingFlags(entityKind: HousingEntityKind, parentNameHint?: string) {
  let isAssignableHousingOption: boolean;
  if (ASSIGNABLE_KINDS.has(entityKind)) {
    isAssignableHousingOption = true;
  } else if (ORGANIZATIONAL_KINDS.has(entityKind)) {
    // Organizational containers — not directly assignable unless Unit (students choose Unit)
    isAssignableHousingOption = entityKind === HousingEntityKind.UNIT;
  } else {
    // UNKNOWN/OTHER: not automatically rankable — requires detail/assignment evidence
    isAssignableHousingOption = false;
  }

  // If we have a parent hint, this is likely a child building → assignable when physical
  if (parentNameHint && PHYSICAL_KINDS.has(entityKind)) {
    isAssignableHousingOption = true;
  }

  const isPhysicalBuilding =
    PHYSICAL_KINDS.has(entityKind) || entityKind === HousingEntityKind.APARTMENT_COMMUNITY;

  return {
    isAssignableHousingOption,
    isPhysicalBuilding,
    rankingGranularity: isAssignableHousingOption,
  };
}

function resolveTriState(
  amenities: string[],
  positive: string,
  negative: string
): boolean | undefined {
  if (amenities.includes(positive)) return true;
  if (amenities.includes(negative)) return false;
  return undefined;
}

function resolveHasAC(ex: ExtractedDorm): boolean | undefined {
  const fromAmenities = resolveTriState(ex.amenities, "ac", "no_ac");
  if (fromAmenities !== undefined) return fromAmenities;
  const fromDescription = ex.description ? normalizeAC(ex.description) : null;
  if (fromDescription === true) return true;
  if (fromDescription === false) return false;
  return undefined;
}

function pickYearlyCost(costs: ExtractedDorm["costs"]): number | undefined {
  const yearly = costs.find(
    (c) => c.period === "yearly" || c.period === "academic_year"
  );
  if (yearly) return yearly.amount;

  const roomOnly = costs.find(
    (c) =>
      c.period !== "room_board" &&
      (/room only|room rate|room cost/i.test(c.label) || c.period === "yearly")
  );
  return roomOnly?.amount;
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

  const hasAC = resolveHasAC(ex);
  const laundryAccess = resolveTriState(ex.amenities, "laundry", "no_laundry");
  const kitchenAccess = resolveTriState(ex.amenities, "kitchen", "no_kitchen");
  const elevatorAccess = resolveTriState(ex.amenities, "elevator", "no_elevator");
  const studyLounges = ex.amenities.includes("study_lounge") ? true : undefined;

  const yearlyCost = pickYearlyCost(ex.costs);

  const classificationConfidence = ex.classification?.confidence ?? 0.6;
  // Activation threshold: low-confidence candidates stay REVIEW, not ACTIVE public inventory
  const activate =
    classificationConfidence >= 0.55 &&
    (opts.isOfficial || classificationConfidence >= 0.7);

  const confidence = sourceConfidence(
    opts.isOfficial ? SourceType.OFFICIAL_WEBSITE : SourceType.OTHER
  );
  const dataCompletenessScore = completenessScore({
    name,
    yearlyCost,
    amenities: ex.amenities.length,
  });

  const entityKind = KIND_MAP[ex.entityKindHint ?? ""] ?? HousingEntityKind.UNKNOWN;
  const housingFlags = inferHousingFlags(entityKind, ex.parentNameHint);

  // Soft preference: strong name + official directory → assignable even if kind UNKNOWN
  let isAssignable = housingFlags.isAssignableHousingOption;
  let rankingGranularity = housingFlags.rankingGranularity;
  if (
    !isAssignable &&
    entityKind === HousingEntityKind.UNKNOWN &&
    classificationConfidence >= 0.7 &&
    opts.isOfficial &&
    (ex.classification?.reasons ?? []).some((r) =>
      /strong_housing_name|repeated_directory|structural_card/i.test(r)
    )
  ) {
    isAssignable = true;
    rankingGranularity = true;
  }

  const baseData = {
    name,
    collegeId: opts.collegeId,
    officialHousingUrl: ex.detailUrl ?? opts.sourceUrl,
    confidenceScore: confidence,
    dataCompletenessScore,
    isVerified: false as const,
    lastUpdatedAt: new Date(),
    entityKind,
    isAssignableHousingOption: isAssignable,
    isPhysicalBuilding: housingFlags.isPhysicalBuilding,
    rankingGranularity,
    isActive: activate,
    dataQualityStatus: activate ? ("ACTIVE" as const) : ("REVIEW" as const),
    officialCategoryLabel: ex.officialCategoryLabel ?? undefined,
    // Eligibility stays unknown unless explicitly extracted (never default true)
    ...(ex.imageUrl ? { imageUrl: ex.imageUrl } : {}),
    ...(yearlyCost != null ? { yearlyCost } : {}),
    ...(ex.description ? { description: ex.description } : {}),
    ...(hasAC === true ? { hasAC: true } : hasAC === false ? { hasAC: false } : {}),
    ...(laundryAccess === true
      ? { laundryAccess: true }
      : laundryAccess === false
        ? { laundryAccess: false }
        : {}),
    ...(kitchenAccess === true
      ? { kitchenAccess: true }
      : kitchenAccess === false
        ? { kitchenAccess: false }
        : {}),
    ...(elevatorAccess === true
      ? { elevatorAccess: true }
      : elevatorAccess === false
        ? { elevatorAccess: false }
        : {}),
    ...(studyLounges ? { studyLounges } : {}),
  };

  if (!activate && !existing) {
    // Still record extraction decision path via caller; skip creating low-confidence dorms
    // unless we already have the entity (then update carefully)
    return null;
  }

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
          elevatorAccess: elevatorAccess ?? null,
          studyLounges: studyLounges ?? null,
          yearlyCost: yearlyCost ?? null,
        },
      });

  // Resolve parent from hint when possible
  if (ex.parentNameHint && !dorm.parentHousingId) {
    const parent = candidates.find(
      (c) =>
        c.id !== dorm.id &&
        (safeSameEntity(c.name, ex.parentNameHint!) ||
          c.name.toLowerCase() === ex.parentNameHint!.toLowerCase())
    );
    if (parent) {
      await prisma.dorm.update({
        where: { id: dorm.id },
        data: { parentHousingId: parent.id },
      });
    }
  }

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

  // Persist detailed cost rows (including room & board) without promoting them to yearlyCost
  for (const cost of ex.costs) {
    const existingCost = await prisma.housingCost.findFirst({
      where: {
        dormId: dorm.id,
        label: cost.label,
        period: cost.period,
        amount: cost.amount,
      },
    });
    if (existingCost) continue;
    await prisma.housingCost.create({
      data: {
        dormId: dorm.id,
        label: cost.label,
        amount: cost.amount,
        period: cost.period,
        confidence,
        isUncertain: cost.uncertain,
        sourceUrl: opts.sourceUrl,
      },
    });
  }

  const scores = computeDormScore({
    yearlyCost: yearlyCost ?? null,
    collegeAvgCost: null,
    hasAC: hasAC ?? null,
    amenityCount: ex.amenities.length || null,
    confidenceScore: confidence,
    dataCompletenessScore,
  });

  const persisted = {
    overallScore: scores.overallScore,
    valueScore: scores.valueScore,
    comfortScore: scores.comfortScore,
    privacyScore: scores.privacyScore,
    socialScore: scores.socialScore,
    convenienceScore: scores.convenienceScore,
    freshmanFitScore: scores.freshmanFitScore,
    amenityScore: scores.amenityScore,
    dataConfidenceScore: scores.dataConfidenceScore,
    scoreable: scores.scoreable,
    evidenceCompleteness: scores.completeness,
    algorithmVersion: scores.algorithmVersion ?? DORMSCOPE_SCORE_VERSION,
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
    { fieldName: "hasAC", value: hasAC === true ? "true" : hasAC === false ? "false" : null },
    {
      fieldName: "laundryAccess",
      value: laundryAccess === true ? "true" : laundryAccess === false ? "false" : null,
    },
    {
      fieldName: "kitchenAccess",
      value: kitchenAccess === true ? "true" : kitchenAccess === false ? "false" : null,
    },
    {
      fieldName: "elevatorAccess",
      value: elevatorAccess === true ? "true" : elevatorAccess === false ? "false" : null,
    },
    { fieldName: "studyLounges", value: studyLounges ? "true" : null },
    { fieldName: "imageUrl", value: ex.imageUrl ?? null },
    { fieldName: "entityKind", value: entityKind },
  ];

  for (const f of fields) {
    if (f.value == null) continue;

    // Conflict detection: different value from another source for same field
    const conflicting = await prisma.fieldProvenance.findFirst({
      where: {
        dormId: dorm.id,
        fieldName: f.fieldName,
        NOT: { valueSnapshot: f.value },
        sourceId: { not: opts.sourceId },
      },
      orderBy: { createdAt: "desc" },
    });
    if (conflicting) {
      const existingConflict = await prisma.fieldConflict.findFirst({
        where: { dormId: dorm.id, fieldName: f.fieldName, status: "OPEN" },
      });
      if (!existingConflict) {
        await prisma.fieldConflict.create({
          data: {
            dormId: dorm.id,
            fieldName: f.fieldName,
            status: "OPEN",
            values: {
              previous: conflicting.valueSnapshot,
              previousSourceId: conflicting.sourceId,
              incoming: f.value,
              incomingSourceId: opts.sourceId,
            },
          },
        });
      }
    }

    const recent = await prisma.fieldProvenance.findFirst({
      where: {
        dormId: dorm.id,
        fieldName: f.fieldName,
        valueSnapshot: f.value,
        sourceId: opts.sourceId,
      },
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
