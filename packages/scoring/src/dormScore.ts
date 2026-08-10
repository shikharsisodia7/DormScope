/**
 * Null-safe dorm quality scoring.
 * Data confidence is tracked separately and does NOT inflate housing quality.
 * Sparse records return overallScore=null (not a fake 0 or 95).
 */
export const DORMSCOPE_SCORE_VERSION = "2.0.0";

/** Minimum known quality dimensions (excluding confidence) required to display overall. */
export const MIN_QUALITY_EVIDENCE = 3;

export interface DormScoreInput {
  yearlyCost?: number | null;
  collegeAvgCost?: number | null;
  hasAC?: boolean | null;
  bathroomStyle?: string | null;
  privacyRating?: number | null;
  socialVibe?: number | null;
  quietVibe?: number | null;
  freshmanEligible?: boolean | null;
  amenityCount?: number | null;
  diningDistanceMeters?: number | null;
  confidenceScore?: number | null;
  dataCompletenessScore?: number | null;
}

export interface ComputedDormScore {
  /** Null when insufficient quality evidence. */
  overallScore: number | null;
  scoreable: boolean;
  valueScore: number | null;
  comfortScore: number | null;
  privacyScore: number | null;
  socialScore: number | null;
  convenienceScore: number | null;
  freshmanFitScore: number | null;
  amenityScore: number | null;
  dataConfidenceScore: number | null;
  /** Fraction of quality components that had real evidence (0–1), excluding confidence. */
  completeness: number;
  algorithmVersion: string;
  breakdown: Record<string, number | null>;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function normalizeBathroom(style: string | null | undefined): string | null {
  if (style == null || style === "") return null;
  const s = style.toUpperCase().trim();
  if (s === "UNKNOWN") return null;
  if (s.includes("PRIVATE") && !s.includes("SEMI")) return "PRIVATE";
  if (s.includes("SUITE")) return "SUITE";
  if (s.includes("COMMUNAL") || s.includes("COMMUNITY")) return "COMMUNAL";
  return s;
}

export function computeDormScore(input: DormScoreInput): ComputedDormScore {
  const quality: Array<{ key: string; score: number | null; weight: number }> = [];

  let valueScore: number | null = null;
  if (input.yearlyCost != null && Number.isFinite(input.yearlyCost)) {
    if (input.collegeAvgCost != null && input.collegeAvgCost > 0) {
      const avg = input.collegeAvgCost;
      valueScore = clamp(100 - ((input.yearlyCost - avg * 0.8) / avg) * 80, 0, 100);
    } else {
      valueScore = clamp(100 - ((input.yearlyCost - 8000) / (22000 - 8000)) * 100, 0, 100);
    }
  }
  quality.push({ key: "valueScore", score: valueScore, weight: 0.18 });

  let comfortScore: number | null = null;
  {
    const parts: number[] = [];
    if (input.hasAC === true) parts.push(85);
    else if (input.hasAC === false) parts.push(40);
    const bath = normalizeBathroom(input.bathroomStyle);
    if (bath === "PRIVATE") parts.push(95);
    else if (bath === "SUITE") parts.push(75);
    else if (bath === "COMMUNAL") parts.push(45);
    if (parts.length > 0) comfortScore = parts.reduce((a, b) => a + b, 0) / parts.length;
  }
  quality.push({ key: "comfortScore", score: comfortScore, weight: 0.18 });

  let privacyScore: number | null = null;
  if (input.privacyRating != null && Number.isFinite(input.privacyRating)) {
    privacyScore = clamp(input.privacyRating * 10, 0, 100);
  } else {
    const bath = normalizeBathroom(input.bathroomStyle);
    if (bath === "PRIVATE") privacyScore = 90;
    else if (bath === "SUITE") privacyScore = 65;
    else if (bath === "COMMUNAL") privacyScore = 35;
  }
  quality.push({ key: "privacyScore", score: privacyScore, weight: 0.14 });

  const socialScore =
    input.socialVibe != null && Number.isFinite(input.socialVibe)
      ? clamp(input.socialVibe * 10, 0, 100)
      : null;
  let socialWithQuiet = socialScore;
  if (socialScore != null && input.quietVibe != null && input.quietVibe > 7) {
    socialWithQuiet = clamp(socialScore + 10, 0, 100);
  }
  quality.push({ key: "socialScore", score: socialWithQuiet, weight: 0.12 });

  let convenienceScore: number | null = null;
  if (input.diningDistanceMeters != null && Number.isFinite(input.diningDistanceMeters)) {
    if (input.diningDistanceMeters < 300) convenienceScore = 85;
    else if (input.diningDistanceMeters < 600) convenienceScore = 75;
    else if (input.diningDistanceMeters < 1000) convenienceScore = 55;
    else convenienceScore = 35;
  }
  quality.push({ key: "convenienceScore", score: convenienceScore, weight: 0.12 });

  const freshmanFitScore =
    input.freshmanEligible === true ? 85 : input.freshmanEligible === false ? 45 : null;
  quality.push({ key: "freshmanFitScore", score: freshmanFitScore, weight: 0.14 });

  const amenityScore =
    input.amenityCount != null && Number.isFinite(input.amenityCount)
      ? clamp((input.amenityCount / 8) * 100, 0, 100)
      : null;
  quality.push({ key: "amenityScore", score: amenityScore, weight: 0.12 });

  // Confidence is tracked separately — never mixed into quality overall.
  let dataConfidenceScore: number | null = null;
  if (input.confidenceScore != null && Number.isFinite(input.confidenceScore)) {
    dataConfidenceScore = Math.round(
      input.confidenceScore <= 1 ? input.confidenceScore * 100 : input.confidenceScore
    );
  } else if (input.dataCompletenessScore != null && Number.isFinite(input.dataCompletenessScore)) {
    dataConfidenceScore = Math.round(
      input.dataCompletenessScore <= 1
        ? input.dataCompletenessScore * 100
        : input.dataCompletenessScore
    );
  }

  let weightedSum = 0;
  let weightTotal = 0;
  let known = 0;
  for (const c of quality) {
    if (c.score != null) {
      weightedSum += c.score * c.weight;
      weightTotal += c.weight;
      known += 1;
    }
  }

  const completeness = quality.length > 0 ? known / quality.length : 0;
  const scoreable = known >= MIN_QUALITY_EVIDENCE && weightTotal > 0;
  const overallScore = scoreable ? Math.round(clamp(weightedSum / weightTotal, 0, 100)) : null;
  const roundOrNull = (n: number | null) => (n == null ? null : Math.round(n));

  return {
    overallScore,
    scoreable,
    valueScore: roundOrNull(valueScore),
    comfortScore: roundOrNull(comfortScore),
    privacyScore: roundOrNull(privacyScore),
    socialScore: roundOrNull(socialWithQuiet),
    convenienceScore: roundOrNull(convenienceScore),
    freshmanFitScore: roundOrNull(freshmanFitScore),
    amenityScore: roundOrNull(amenityScore),
    dataConfidenceScore: dataConfidenceScore != null ? Math.round(dataConfidenceScore) : null,
    completeness,
    algorithmVersion: DORMSCOPE_SCORE_VERSION,
    breakdown: {
      valueScore,
      comfortScore,
      privacyScore,
      socialScore: socialWithQuiet,
      convenienceScore,
      freshmanFitScore,
      amenityScore,
      dataConfidenceScore,
    },
  };
}

export function explainScore(score: ComputedDormScore): string[] {
  const lines: string[] = [];
  if (!score.scoreable || score.overallScore == null) {
    lines.push("Not enough data to compute a DormScope quality score yet.");
    return lines;
  }
  if (score.valueScore != null && score.valueScore >= 70) {
    lines.push("Strong value relative to typical costs at this school.");
  } else if (score.valueScore != null && score.valueScore < 45) {
    lines.push("Higher cost than many peers — comfort and amenities may justify it.");
  }
  if (score.comfortScore != null && score.comfortScore >= 75) {
    lines.push("Comfort features like AC and bathroom style boost this score.");
  }
  if (score.privacyScore != null && score.privacyScore >= 70) {
    lines.push("Better privacy — suite or private bathrooms, or high privacy rating.");
  }
  if (score.socialScore != null && score.socialScore >= 75) {
    lines.push("Known as a social dorm — good if you want to meet people.");
  }
  if (score.freshmanFitScore != null && score.freshmanFitScore >= 80) {
    lines.push("Especially suitable for first-year students.");
  }
  if (score.dataConfidenceScore != null && score.dataConfidenceScore < 60) {
    lines.push("Some data is uncertain — verify on the official housing site.");
  }
  if (score.completeness < 0.5) {
    lines.push("Limited data available — score is based on fewer known attributes.");
  }
  return lines;
}
