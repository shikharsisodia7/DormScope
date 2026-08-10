import {
  PreferenceImportance,
  getPreferenceDimension,
  listPreferenceDimensions,
  type ConfidenceLabel,
  type DimensionScoreResult,
  type HardConstraints,
  type MatchExplanation,
  type PreferenceDimensionDef,
  type PreferenceProfile,
} from "@dormscope/shared";

export const ALGORITHM_VERSION = "1.0.0";

/** Evidence-bearing dorm shape used by the personalized ranker. All fields optional/nullable. */
export interface RankableDorm {
  id: string;
  name: string;
  slug?: string;
  collegeName?: string;
  yearlyCost?: number | null;
  semesterCost?: number | null;
  collegeAvgCost?: number | null;
  hasAC?: boolean | null;
  bathroomStyle?: string | null;
  dormType?: string | null;
  freshmanEligible?: boolean | null;
  upperclassEligible?: boolean | null;
  honorsHousing?: boolean | null;
  themedHousing?: boolean | null;
  genderInclusive?: boolean | null;
  substanceFree?: boolean | null;
  isSubstanceFree?: boolean | null;
  accessible?: boolean | null;
  isAccessible?: boolean | null;
  elevatorAccess?: boolean | null;
  laundryAccess?: boolean | null;
  kitchenAccess?: boolean | null;
  studyLounges?: boolean | null;
  hasLounge?: boolean | null;
  hasStorage?: boolean | null;
  hasSingle?: boolean | null;
  hasDouble?: boolean | null;
  hasPrivateBathroom?: boolean | null;
  hasSuiteBathroom?: boolean | null;
  hasCommunalBathroom?: boolean | null;
  isRenovated?: boolean | null;
  isLivingLearning?: boolean | null;
  socialVibe?: number | null;
  quietVibe?: number | null;
  cleanlinessRating?: number | null;
  privacyRating?: number | null;
  spaciousnessRating?: number | null;
  roomSpaciousness?: number | null;
  naturalLightRating?: number | null;
  storageRating?: number | null;
  communityRating?: number | null;
  walkabilityRating?: number | null;
  overallSatisfaction?: number | null;
  overallScore?: number | null;
  amenityCount?: number | null;
  amenityFlags?: string[] | null;
  roomTypes?: Array<{ normalized?: string; name?: string; capacity?: number | null }> | null;
  diningDistanceMeters?: number | null;
  gymDistanceMeters?: number | null;
  classroomDistanceMeters?: number | null;
  academicDistanceMeters?: number | null;
  libraryDistanceMeters?: number | null;
  socialDistanceMeters?: number | null;
  parkingDistanceMeters?: number | null;
  campusZone?: string | null;
  buildingAge?: number | null;
  renovationYear?: number | null;
  buildingCapacity?: number | null;
  residentCount?: number | null;
  confidenceScore?: number | null;
  dataCompletenessScore?: number | null;
  lastUpdatedAt?: Date | string | null;
  /** When false, entity is organizational (e.g. village container) — exclude from Match. */
  isAssignableHousingOption?: boolean | null;
  /** When false, entity is informational only — exclude from Match rankings. */
  rankingGranularity?: boolean | null;
  dormScore?: {
    overallScore?: number | null;
    scoreable?: boolean;
    valueScore?: number | null;
    comfortScore?: number | null;
    privacyScore?: number | null;
    socialScore?: number | null;
    convenienceScore?: number | null;
    freshmanFitScore?: number | null;
  } | null;
}

export interface RankOptions {
  /** Cap results after ranking */
  limit?: number;
  /** Current year for renovation freshness scoring (defaults to calendar year) */
  currentYear?: number;
  /** Proximity distance (m) that maps to score 0; closer = higher. Default 1200 */
  proximityMaxMeters?: number;
}

export interface RankedMatch<T extends RankableDorm = RankableDorm> {
  dorm: T;
  matchScore: number;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  reasons: MatchExplanation;
  dimensionScores: Record<string, DimensionScoreResult>;
  excluded?: false;
  algorithmVersion: string;
}

export interface ExcludedMatch<T extends RankableDorm = RankableDorm> {
  dorm: T;
  reasons: string[];
}

export interface UnverifiedMatch<T extends RankableDorm = RankableDorm> {
  dorm: T;
  reasons: string[];
}

export interface HardConstraintFilterResult<T extends RankableDorm = RankableDorm> {
  /** Confirmed to satisfy all active hard requirements (or no hard reqs). */
  eligible: T[];
  /** Known to violate at least one hard requirement. */
  excluded: ExcludedMatch<T>[];
  /**
   * Does not have known violations, but one or more required facts are unknown
   * (e.g. AC unknown when requireAC, cost unknown when maxBudget).
   */
  unverified: UnverifiedMatch<T>[];
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function readDormField(dorm: RankableDorm, field: string): unknown {
  return (dorm as unknown as Record<string, unknown>)[field];
}

function isKnownBoolean(v: unknown): v is boolean {
  return v === true || v === false;
}

function normalizeBathroom(style: string | null | undefined): string | null {
  if (style == null || style === "") return null;
  const s = style.toUpperCase().trim();
  if (s === "UNKNOWN" || s === "UNKNOWN_BATHROOM") return null;
  if (s.includes("PRIVATE") && !s.includes("SEMI")) return "PRIVATE";
  if (s.includes("SEMI")) return "SEMI_PRIVATE";
  if (s.includes("SUITE")) return "SUITE";
  if (s.includes("COMMUNAL") || s.includes("COMMUNITY") || s.includes("SHARED")) return "COMMUNAL";
  return s;
}

function dormHasPrivateBath(dorm: RankableDorm): boolean | null {
  if (isKnownBoolean(dorm.hasPrivateBathroom)) return dorm.hasPrivateBathroom;
  const bath = normalizeBathroom(dorm.bathroomStyle);
  if (bath == null) return null;
  return bath === "PRIVATE";
}

function dormHasSuiteBath(dorm: RankableDorm): boolean | null {
  if (isKnownBoolean(dorm.hasSuiteBathroom)) return dorm.hasSuiteBathroom;
  const bath = normalizeBathroom(dorm.bathroomStyle);
  if (bath == null) return null;
  return bath === "SUITE" || bath === "SEMI_PRIVATE";
}

function dormHasCommunalBath(dorm: RankableDorm): boolean | null {
  if (isKnownBoolean(dorm.hasCommunalBathroom)) return dorm.hasCommunalBathroom;
  const bath = normalizeBathroom(dorm.bathroomStyle);
  if (bath == null) return null;
  return bath === "COMMUNAL";
}

function dormHasSingle(dorm: RankableDorm): boolean | null {
  if (isKnownBoolean(dorm.hasSingle)) return dorm.hasSingle;
  if (!dorm.roomTypes) return null;
  if (dorm.roomTypes.length === 0) return null;
  return dorm.roomTypes.some((r) => {
    const n = (r.normalized ?? r.name ?? "").toLowerCase();
    return n.includes("single") || r.capacity === 1;
  });
}

function dormHasDouble(dorm: RankableDorm): boolean | null {
  if (isKnownBoolean(dorm.hasDouble)) return dorm.hasDouble;
  if (!dorm.roomTypes) return null;
  if (dorm.roomTypes.length === 0) return null;
  return dorm.roomTypes.some((r) => {
    const n = (r.normalized ?? r.name ?? "").toLowerCase();
    return n.includes("double") || r.capacity === 2;
  });
}

function firstNumber(...vals: Array<number | null | undefined>): number | null {
  for (const v of vals) {
    if (v != null && Number.isFinite(v)) return v;
  }
  return null;
}

function qualityFromRating(rating: number | null | undefined, scaleMax = 10): number | null {
  if (rating == null || !Number.isFinite(rating)) return null;
  return clamp((rating / scaleMax) * 100, 0, 100);
}

function proximityScore(meters: number | null | undefined, maxMeters: number): number | null {
  if (meters == null || !Number.isFinite(meters)) return null;
  if (meters < 0) return null;
  return clamp(100 * (1 - meters / maxMeters), 0, 100);
}

function costAffordabilityScore(
  yearlyCost: number | null | undefined,
  collegeAvgCost: number | null | undefined
): number | null {
  if (yearlyCost == null || !Number.isFinite(yearlyCost)) return null;
  const avg = collegeAvgCost != null && collegeAvgCost > 0 ? collegeAvgCost : null;
  if (avg == null) {
    // Absolute heuristic only when we have a real cost — no invented peer average.
    // Map common yearly range ~8k–22k into 100–0 without inventing missing peer data as 15000.
    const lo = 8000;
    const hi = 22000;
    return clamp(100 - ((yearlyCost - lo) / (hi - lo)) * 100, 0, 100);
  }
  // Below 80% of avg → high score; at 140% of avg → near 0
  const ratio = yearlyCost / avg;
  return clamp(100 - ((ratio - 0.8) / 0.6) * 100, 0, 100);
}

function valueScore(dorm: RankableDorm): number | null {
  const afford = costAffordabilityScore(dorm.yearlyCost, dorm.collegeAvgCost);
  const quality = firstNumber(
    qualityFromRating(dorm.overallSatisfaction),
    qualityFromRating(dorm.overallScore != null && dorm.overallScore > 10 ? dorm.overallScore / 10 : dorm.overallScore),
    dorm.dormScore?.overallScore ?? null
  );
  if (afford == null && quality == null) return null;
  if (afford == null) return quality;
  if (quality == null) return afford;
  return clamp(afford * 0.55 + quality * 0.45, 0, 100);
}

function renovatedScore(dorm: RankableDorm, currentYear: number): number | null {
  if (isKnownBoolean(dorm.isRenovated)) return dorm.isRenovated ? 90 : 35;
  if (dorm.renovationYear != null && Number.isFinite(dorm.renovationYear)) {
    const age = currentYear - dorm.renovationYear;
    if (age <= 5) return 95;
    if (age <= 10) return 80;
    if (age <= 20) return 55;
    return 30;
  }
  if (dorm.buildingAge != null && Number.isFinite(dorm.buildingAge)) {
    if (dorm.buildingAge <= 10) return 85;
    if (dorm.buildingAge <= 25) return 55;
    return 30;
  }
  return null;
}

function bathroomPrivacyScore(dorm: RankableDorm): number | null {
  const rating = qualityFromRating(dorm.privacyRating);
  const bath = normalizeBathroom(dorm.bathroomStyle);
  let fromStyle: number | null = null;
  if (bath === "PRIVATE") fromStyle = 95;
  else if (bath === "SEMI_PRIVATE") fromStyle = 80;
  else if (bath === "SUITE") fromStyle = 70;
  else if (bath === "COMMUNAL") fromStyle = 30;
  // Unknown bathroom style → null (do NOT invent mid values)
  if (rating == null && fromStyle == null) return null;
  if (rating == null) return fromStyle;
  if (fromStyle == null) return rating;
  return clamp(rating * 0.5 + fromStyle * 0.5, 0, 100);
}

function buildingSizeScore(dorm: RankableDorm, preferSmall: boolean): number | null {
  const size = firstNumber(dorm.buildingCapacity, dorm.residentCount);
  if (size == null) return null;
  // Typical halls: 50–800 residents
  const normalizedLarge = clamp(((size - 50) / 750) * 100, 0, 100);
  return preferSmall ? 100 - normalizedLarge : normalizedLarge;
}

function amenityCountScore(count: number | null | undefined): number | null {
  if (count == null || !Number.isFinite(count)) return null;
  return clamp((count / 8) * 100, 0, 100);
}

function categoricalMatch(
  value: string | null | undefined,
  preferred: string[] | undefined
): number | null {
  if (value == null || value === "" || value.toUpperCase() === "UNKNOWN") return null;
  if (!preferred || preferred.length === 0) return null;
  const v = value.toUpperCase();
  const hit = preferred.some((p) => v === p.toUpperCase() || v.includes(p.toUpperCase()));
  return hit ? 100 : 0;
}

function studyEnvironmentScore(dorm: RankableDorm): number | null {
  const lounge = dorm.studyLounges;
  const quiet = dorm.quietVibe;
  if (!isKnownBoolean(lounge) && quiet == null) return null;
  let score = 0;
  let parts = 0;
  if (isKnownBoolean(lounge)) {
    score += lounge ? 100 : 20;
    parts += 1;
  }
  if (quiet != null) {
    score += qualityFromRating(quiet) ?? 0;
    parts += 1;
  }
  return parts > 0 ? score / parts : null;
}

function apartmentIndependenceScore(dorm: RankableDorm): number | null {
  const type = dorm.dormType;
  const kitchen = dorm.kitchenAccess;
  const typeKnown = type != null && type !== "" && type.toUpperCase() !== "UNKNOWN";
  if (!typeKnown && !isKnownBoolean(kitchen)) return null;
  let score = 0;
  let parts = 0;
  if (typeKnown) {
    const t = type!.toUpperCase();
    score += t.includes("APARTMENT") || t.includes("TOWNHOUSE") ? 100 : 20;
    parts += 1;
  }
  if (isKnownBoolean(kitchen)) {
    score += kitchen ? 100 : 30;
    parts += 1;
  }
  return parts > 0 ? score / parts : null;
}

function livingLearningScore(dorm: RankableDorm): boolean | null {
  if (isKnownBoolean(dorm.isLivingLearning)) return dorm.isLivingLearning;
  if (isKnownBoolean(dorm.honorsHousing) || isKnownBoolean(dorm.themedHousing)) {
    return Boolean(dorm.honorsHousing || dorm.themedHousing);
  }
  return null;
}

function accessibilityScore(dorm: RankableDorm): boolean | null {
  if (isKnownBoolean(dorm.accessible)) return dorm.accessible;
  if (isKnownBoolean(dorm.isAccessible)) return dorm.isAccessible;
  if (isKnownBoolean(dorm.elevatorAccess)) return dorm.elevatorAccess;
  return null;
}

function substanceFreeScore(dorm: RankableDorm): boolean | null {
  if (isKnownBoolean(dorm.substanceFree)) return dorm.substanceFree;
  if (isKnownBoolean(dorm.isSubstanceFree)) return dorm.isSubstanceFree;
  return null;
}

function booleanEvidenceForDimension(
  dorm: RankableDorm,
  dim: PreferenceDimensionDef
): boolean | null {
  switch (dim.id) {
    case "privateBathroom":
      return dormHasPrivateBath(dorm);
    case "suiteBathroom":
      return dormHasSuiteBath(dorm);
    case "communalBathroomOk":
      return dormHasCommunalBath(dorm);
    case "roomTypeSingle":
      return dormHasSingle(dorm);
    case "roomTypeDouble":
      return dormHasDouble(dorm);
    case "airConditioning":
      return isKnownBoolean(dorm.hasAC) ? dorm.hasAC : null;
    case "kitchens":
      return isKnownBoolean(dorm.kitchenAccess) ? dorm.kitchenAccess : null;
    case "laundry":
      return isKnownBoolean(dorm.laundryAccess) ? dorm.laundryAccess : null;
    case "commonLounges":
      if (isKnownBoolean(dorm.hasLounge)) return dorm.hasLounge;
      if (isKnownBoolean(dorm.studyLounges)) return dorm.studyLounges;
      return null;
    case "freshmanFriendly":
      return isKnownBoolean(dorm.freshmanEligible) ? dorm.freshmanEligible : null;
    case "upperclassFriendly":
      return isKnownBoolean(dorm.upperclassEligible) ? dorm.upperclassEligible : null;
    case "genderInclusive":
      return isKnownBoolean(dorm.genderInclusive) ? dorm.genderInclusive : null;
    case "substanceFree":
      return substanceFreeScore(dorm);
    case "accessibility":
      return accessibilityScore(dorm);
    case "elevator":
      return isKnownBoolean(dorm.elevatorAccess) ? dorm.elevatorAccess : null;
    case "livingLearning":
      return livingLearningScore(dorm);
    case "studyEnvironment": {
      const s = studyEnvironmentScore(dorm);
      if (s == null) return null;
      return s >= 50;
    }
    case "apartmentIndependence": {
      const s = apartmentIndependenceScore(dorm);
      if (s == null) return null;
      return s >= 50;
    }
    case "storage":
      if (isKnownBoolean(dorm.hasStorage)) return dorm.hasStorage;
      return null;
    default:
      return null;
  }
}

/**
 * Score a single dimension 0–100, or null when evidence is missing.
 * Null means: skip this dimension in both numerator and denominator.
 */
export function scoreDimension(
  dorm: RankableDorm,
  dim: PreferenceDimensionDef,
  profile: PreferenceProfile,
  options: RankOptions = {}
): number | null {
  const maxProx = options.proximityMaxMeters ?? 1200;
  const year = options.currentYear ?? new Date().getFullYear();

  switch (dim.scoringMode) {
    case "quality": {
      if (dim.id === "bathroomPrivacy") return bathroomPrivacyScore(dorm);
      if (dim.id === "renovatedNewer") return renovatedScore(dorm, year);
      if (dim.id === "buildingAmenities") return amenityCountScore(dorm.amenityCount);
      if (dim.id === "buildingSizeSmall") return buildingSizeScore(dorm, true);
      if (dim.id === "buildingSizeLarge") return buildingSizeScore(dorm, false);
      if (dim.id === "communityAtmosphere") {
        return firstNumber(
          qualityFromRating(dorm.communityRating),
          qualityFromRating(dorm.socialVibe)
        );
      }
      if (dim.id === "overallSatisfaction") {
        return firstNumber(
          qualityFromRating(dorm.overallSatisfaction),
          dorm.overallScore != null && dorm.overallScore <= 10
            ? qualityFromRating(dorm.overallScore)
            : dorm.overallScore ?? null,
          dorm.dormScore?.overallScore ?? null
        );
      }
      if (dim.id === "roomSpaciousness") {
        return firstNumber(
          qualityFromRating(dorm.spaciousnessRating),
          qualityFromRating(dorm.roomSpaciousness)
        );
      }
      if (dim.id === "storage") {
        const rating = qualityFromRating(dorm.storageRating);
        if (rating != null) return rating;
        if (isKnownBoolean(dorm.hasStorage)) return dorm.hasStorage ? 75 : 25;
        return null;
      }
      // Default: first evidence field as 0–10 quality rating
      for (const field of dim.evidenceFields) {
        const raw = readDormField(dorm, field);
        if (typeof raw === "number" && Number.isFinite(raw)) {
          // If already 0–100, keep; if 0–10, scale
          return raw > 10 ? clamp(raw, 0, 100) : qualityFromRating(raw);
        }
      }
      return null;
    }
    case "boolean_match": {
      if (dim.id === "studyEnvironment") return studyEnvironmentScore(dorm);
      if (dim.id === "apartmentIndependence") return apartmentIndependenceScore(dorm);
      const b = booleanEvidenceForDimension(dorm, dim);
      if (b == null) return null;
      // For communalBathroomOk: wanting communal OK means communal = high, else lower
      if (dim.id === "communalBathroomOk") {
        const desired = profile.toggles?.[dim.id];
        if (desired === false) return b ? 20 : 80;
        return b ? 100 : 40;
      }
      return b ? 100 : 0;
    }
    case "proximity": {
      if (dim.id === "location") {
        const parts = [
          proximityScore(dorm.diningDistanceMeters, maxProx),
          proximityScore(
            firstNumber(dorm.classroomDistanceMeters, dorm.academicDistanceMeters),
            maxProx
          ),
          proximityScore(dorm.gymDistanceMeters, maxProx),
        ].filter((x): x is number => x != null);
        if (parts.length === 0) return null;
        return parts.reduce((a, b) => a + b, 0) / parts.length;
      }
      for (const field of dim.evidenceFields) {
        const raw = readDormField(dorm, field);
        if (typeof raw === "number" && Number.isFinite(raw)) {
          return proximityScore(raw, maxProx);
        }
      }
      return null;
    }
    case "cost": {
      if (dim.id === "value") return valueScore(dorm);
      return costAffordabilityScore(dorm.yearlyCost, dorm.collegeAvgCost);
    }
    case "categorical": {
      if (dim.id === "traditionalDormExperience") {
        const typeScore = categoricalMatch(dorm.dormType, dim.preferredCategories);
        const bath = normalizeBathroom(dorm.bathroomStyle);
        if (typeScore == null && bath == null) return null;
        let score = typeScore ?? 50;
        if (bath === "COMMUNAL") score = clamp(score + 15, 0, 100);
        return score;
      }
      return categoricalMatch(dorm.dormType, dim.preferredCategories);
    }
    case "spectrum": {
      const userPos = profile.spectrumValues?.[dim.id];
      if (userPos == null) return null;
      // Map first quality evidence to 0–1 and score closeness
      for (const field of dim.evidenceFields) {
        const raw = readDormField(dorm, field);
        if (typeof raw === "number" && Number.isFinite(raw)) {
          const dormPos = raw > 1 ? raw / 10 : raw;
          const target = userPos > 1 ? userPos / 10 : userPos;
          const dist = Math.abs(dormPos - target);
          return clamp((1 - dist) * 100, 0, 100);
        }
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Match rankings include only assignable housing options at the correct granularity.
 * Parent complexes/villages and informational child buildings are excluded.
 */
export function filterMatchableDorms<T extends RankableDorm>(dorms: T[]): T[] {
  return dorms.filter(
    (d) => d.isAssignableHousingOption !== false && d.rankingGranularity !== false
  );
}

/**
 * Hard constraints:
 * - known violation → excluded
 * - required fact unknown → unverified (not silently treated as satisfied)
 * - known satisfaction / no hard reqs → eligible
 */
export function filterByHardConstraints<T extends RankableDorm>(
  dorms: T[],
  constraints: HardConstraints
): HardConstraintFilterResult<T> {
  const eligible: T[] = [];
  const excluded: ExcludedMatch<T>[] = [];
  const unverified: UnverifiedMatch<T>[] = [];

  for (const dorm of dorms) {
    const violate: string[] = [];
    const unknown: string[] = [];

    if (constraints.requireFreshmanEligible === true) {
      if (dorm.freshmanEligible === false) violate.push("Not eligible for freshmen");
      else if (dorm.freshmanEligible == null) unknown.push("Freshman eligibility not verified");
    }

    if (constraints.requireUpperclassEligible === true) {
      if (dorm.upperclassEligible === false) violate.push("Not eligible for upperclass students");
      else if (dorm.upperclassEligible == null) unknown.push("Upperclass eligibility not verified");
    }

    if (constraints.maxBudget != null && Number.isFinite(constraints.maxBudget)) {
      if (dorm.yearlyCost != null && dorm.yearlyCost > constraints.maxBudget) {
        violate.push(`Yearly cost exceeds budget of $${constraints.maxBudget}`);
      } else if (dorm.yearlyCost == null) {
        unknown.push("Cost not verified against budget");
      }
    }

    if (constraints.requireSingle === true) {
      const has = dormHasSingle(dorm);
      if (has === false) violate.push("No single rooms available");
      else if (has == null) unknown.push("Single-room availability not verified");
    }

    if (constraints.requirePrivateBath === true || constraints.privateBathroom === true || constraints.requirePrivateBathroom === true) {
      const has = dormHasPrivateBath(dorm);
      if (has === false) violate.push("Does not have a private bathroom");
      else if (has == null) unknown.push("Private bathroom not verified");
    }

    if (constraints.requirePrivateOrSuiteBath === true) {
      const priv = dormHasPrivateBath(dorm);
      const suite = dormHasSuiteBath(dorm);
      if (priv === false && suite === false) {
        violate.push("Bathroom is communal; private or suite required");
      } else if (priv === false && suite == null) {
        const bath = normalizeBathroom(dorm.bathroomStyle);
        if (bath === "COMMUNAL") {
          violate.push("Bathroom is communal; private or suite required");
        } else if (bath === "UNKNOWN" || bath == null) {
          unknown.push("Private/suite bathroom not verified");
        }
      } else if (priv == null && suite == null) {
        unknown.push("Private/suite bathroom not verified");
      }
    }

    if (constraints.requireGenderInclusive === true || constraints.genderInclusive === true) {
      if (dorm.genderInclusive === false) violate.push("Not gender-inclusive housing");
      else if (dorm.genderInclusive == null) unknown.push("Gender-inclusive status not verified");
    }

    if (constraints.requireAC === true || constraints.airConditioning === true) {
      if (dorm.hasAC === false) violate.push("No air conditioning");
      else if (dorm.hasAC == null) unknown.push("Air conditioning not verified");
    }

    if (constraints.requireAccessibility === true || constraints.accessibility === true) {
      const a = accessibilityScore(dorm);
      if (a === false) violate.push("Accessibility features not available");
      else if (a == null) unknown.push("Accessibility not verified");
    }

    if (constraints.requireSubstanceFree === true) {
      const s = substanceFreeScore(dorm);
      if (s === false) violate.push("Not a substance-free community");
      else if (s == null) unknown.push("Substance-free status not verified");
    }

    if (constraints.requireElevator === true) {
      if (dorm.elevatorAccess === false) violate.push("No elevator access");
      else if (dorm.elevatorAccess == null) unknown.push("Elevator access not verified");
    }

    if (constraints.freshmanFriendly === true) {
      if (dorm.freshmanEligible === false) violate.push("Not eligible for freshmen");
      else if (dorm.freshmanEligible == null) unknown.push("Freshman eligibility not verified");
    }

    if (violate.length > 0) {
      excluded.push({ dorm, reasons: violate });
    } else if (unknown.length > 0) {
      unverified.push({ dorm, reasons: unknown });
    } else {
      eligible.push(dorm);
    }
  }

  return { eligible, excluded, unverified };
}

function confidenceLabelFromScore(confidence: number): ConfidenceLabel {
  if (confidence >= 75) return "high";
  if (confidence >= 50) return "medium";
  if (confidence >= 25) return "low";
  return "very_low";
}

function dataFreshnessFactor(dorm: RankableDorm, now: number): number {
  if (!dorm.lastUpdatedAt) return 0.7; // unknown freshness → neutral-low, not inventing "fresh"
  const t = typeof dorm.lastUpdatedAt === "string" ? Date.parse(dorm.lastUpdatedAt) : dorm.lastUpdatedAt.getTime();
  if (!Number.isFinite(t)) return 0.7;
  const ageDays = (now - t) / (1000 * 60 * 60 * 24);
  if (ageDays <= 180) return 1;
  if (ageDays <= 365) return 0.9;
  if (ageDays <= 730) return 0.75;
  return 0.55;
}

function reviewEvidenceFactor(dorm: RankableDorm): number {
  // Prefer explicit confidence / completeness when present; never invent.
  const conf =
    dorm.confidenceScore != null && Number.isFinite(dorm.confidenceScore)
      ? dorm.confidenceScore <= 1
        ? dorm.confidenceScore
        : dorm.confidenceScore / 100
      : null;
  const complete =
    dorm.dataCompletenessScore != null && Number.isFinite(dorm.dataCompletenessScore)
      ? dorm.dataCompletenessScore <= 1
        ? dorm.dataCompletenessScore
        : dorm.dataCompletenessScore / 100
      : null;
  if (conf == null && complete == null) return 0.6;
  if (conf == null) return complete!;
  if (complete == null) return conf;
  return conf * 0.6 + complete * 0.4;
}

function buildReasons(
  dimensionScores: Record<string, DimensionScoreResult>,
  profile: PreferenceProfile
): MatchExplanation {
  const positives: string[] = [];
  const tradeoffs: string[] = [];
  const unknowns: string[] = [];

  const entries = Object.entries(dimensionScores).sort((a, b) => b[1].weight - a[1].weight);

  for (const [id, result] of entries) {
    if (result.weight <= 0) continue;
    const dim = getPreferenceDimension(id);
    if (!dim) continue;

    if (!result.hasEvidence) {
      if (unknowns.length < 5) unknowns.push(dim.explanations.unknown);
      continue;
    }

    if (result.explanation) {
      if (result.score >= 65 && positives.length < 5) positives.push(result.explanation);
      else if (result.score < 45 && tradeoffs.length < 5) tradeoffs.push(result.explanation);
      continue;
    }

    if (result.score >= 65 && positives.length < 5) {
      positives.push(dim.explanations.positive);
    } else if (result.score < 45 && tradeoffs.length < 5) {
      tradeoffs.push(dim.explanations.negative);
    }
  }

  // Surface hard-constraint-related unknowns for must-have soft weights
  for (const [id, w] of Object.entries(profile.weights)) {
    if ((w ?? 0) < PreferenceImportance.VERY) continue;
    if (dimensionScores[id]?.hasEvidence === false) {
      const dim = getPreferenceDimension(id);
      if (dim && !unknowns.includes(dim.explanations.unknown) && unknowns.length < 6) {
        unknowns.push(dim.explanations.unknown);
      }
    }
  }

  return { positives, tradeoffs, unknowns };
}

/**
 * Rank dorms for a preference profile.
 * Soft prefs with weight>0 contribute only when evidence exists.
 */
export function rankDormsForPreferences<T extends RankableDorm>(
  dorms: T[],
  profile: PreferenceProfile,
  options: RankOptions = {}
): RankedMatch<T>[] {
  const { eligible } = filterByHardConstraints(dorms, profile.hardConstraints ?? {});
  const dims = listPreferenceDimensions();
  const now = Date.now();

  const ranked: RankedMatch<T>[] = eligible.map((dorm) => {
    const dimensionScores: Record<string, DimensionScoreResult> = {};
    let weightedSum = 0;
    let weightTotal = 0;
    let evidenceWeight = 0;
    let preferenceWeightMass = 0;

    for (const dim of dims) {
      const rawWeight = profile.weights[dim.id] ?? 0;
      const weight = typeof rawWeight === "number" ? rawWeight : 0;
      if (weight <= 0) continue;

      preferenceWeightMass += weight;
      const score = scoreDimension(dorm, dim, profile, options);
      const hasEvidence = score != null;

      let explanation: string | undefined;
      if (hasEvidence) {
        explanation =
          score! >= 65
            ? dim.explanations.positive
            : score! < 45
              ? dim.explanations.negative
              : undefined;
        weightedSum += score! * weight;
        weightTotal += weight;
        evidenceWeight += weight;
      }

      dimensionScores[dim.id] = {
        score: hasEvidence ? Math.round(score!) : 0,
        weight,
        hasEvidence,
        explanation: hasEvidence
          ? explanation
          : dim.explanations.unknown,
      };
    }

    const matchScore =
      weightTotal > 0 ? Math.round(clamp(weightedSum / weightTotal, 0, 100)) : 0;

    const coverage =
      preferenceWeightMass > 0 ? evidenceWeight / preferenceWeightMass : 1;
    const freshness = dataFreshnessFactor(dorm, now);
    const reviewFactor = reviewEvidenceFactor(dorm);
    const confidence = Math.round(
      clamp((coverage * 0.55 + reviewFactor * 0.3 + freshness * 0.15) * 100, 0, 100)
    );

    const reasons = buildReasons(dimensionScores, profile);

    return {
      dorm,
      matchScore,
      confidence,
      confidenceLabel: confidenceLabelFromScore(confidence),
      reasons,
      dimensionScores,
      excluded: false as const,
      algorithmVersion: ALGORITHM_VERSION,
    };
  });

  ranked.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.dorm.name.localeCompare(b.dorm.name);
  });

  if (options.limit != null && options.limit >= 0) {
    return ranked.slice(0, options.limit);
  }
  return ranked;
}
