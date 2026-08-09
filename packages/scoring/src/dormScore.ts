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
  overallScore: number;
  valueScore: number | null;
  comfortScore: number | null;
  privacyScore: number | null;
  socialScore: number | null;
  convenienceScore: number | null;
  freshmanFitScore: number | null;
  amenityScore: number | null;
  dataConfidenceScore: number | null;
  /** Fraction of components that had real evidence (0–1) */
  completeness: number;
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

/**
 * Null-safe dorm score. Unknown/null fields are omitted from the weighted average
 * (they reduce completeness, never invent mid-values like vibe=5 or cost=15000).
 */
export function computeDormScore(input: DormScoreInput): ComputedDormScore {
  const components: Array<{ key: string; score: number | null; weight: number }> = [];

  // Value — only when yearly cost is known. Do NOT invent collegeAvgCost as cost.
  let valueScore: number | null = null;
  if (input.yearlyCost != null && Number.isFinite(input.yearlyCost)) {
    if (input.collegeAvgCost != null && input.collegeAvgCost > 0) {
      const avg = input.collegeAvgCost;
      valueScore = clamp(100 - ((input.yearlyCost - avg * 0.8) / avg) * 80, 0, 100);
    } else {
      const lo = 8000;
      const hi = 22000;
      valueScore = clamp(100 - ((input.yearlyCost - lo) / (hi - lo)) * 100, 0, 100);
    }
  }
  components.push({ key: "valueScore", score: valueScore, weight: 0.15 });

  // Comfort — AC and bathroom style; skip pieces that are unknown
  let comfortScore: number | null = null;
  {
    const parts: number[] = [];
    if (input.hasAC === true) parts.push(85);
    else if (input.hasAC === false) parts.push(40);
    const bath = normalizeBathroom(input.bathroomStyle);
    if (bath === "PRIVATE") parts.push(95);
    else if (bath === "SUITE") parts.push(75);
    else if (bath === "COMMUNAL") parts.push(45);
    if (parts.length > 0) {
      comfortScore = parts.reduce((a, b) => a + b, 0) / parts.length;
    }
  }
  components.push({ key: "comfortScore", score: comfortScore, weight: 0.15 });

  // Privacy — rating or known bathroom style only
  let privacyScore: number | null = null;
  if (input.privacyRating != null && Number.isFinite(input.privacyRating)) {
    privacyScore = clamp(input.privacyRating * 10, 0, 100);
  } else {
    const bath = normalizeBathroom(input.bathroomStyle);
    if (bath === "PRIVATE") privacyScore = 90;
    else if (bath === "SUITE") privacyScore = 65;
    else if (bath === "COMMUNAL") privacyScore = 35;
  }
  components.push({ key: "privacyScore", score: privacyScore, weight: 0.12 });

  // Social — never default vibe to 5
  const socialScore =
    input.socialVibe != null && Number.isFinite(input.socialVibe)
      ? clamp(input.socialVibe * 10, 0, 100)
      : null;
  let socialWithQuiet = socialScore;
  if (socialScore != null && input.quietVibe != null && input.quietVibe > 7) {
    socialWithQuiet = clamp(socialScore + 10, 0, 100);
  }
  components.push({ key: "socialScore", score: socialWithQuiet, weight: 0.1 });

  // Convenience — only when dining distance is known (do NOT invent 500m)
  let convenienceScore: number | null = null;
  if (input.diningDistanceMeters != null && Number.isFinite(input.diningDistanceMeters)) {
    if (input.diningDistanceMeters < 300) convenienceScore = 85;
    else if (input.diningDistanceMeters < 600) convenienceScore = 75;
    else if (input.diningDistanceMeters < 1000) convenienceScore = 55;
    else convenienceScore = 35;
  }
  components.push({ key: "convenienceScore", score: convenienceScore, weight: 0.1 });

  // Freshman fit — only when eligibility is known
  const freshmanFitScore =
    input.freshmanEligible === true ? 85 : input.freshmanEligible === false ? 45 : null;
  components.push({ key: "freshmanFitScore", score: freshmanFitScore, weight: 0.13 });

  // Amenities — only when count is known (do NOT invent amenityCount=3)
  const amenityScore =
    input.amenityCount != null && Number.isFinite(input.amenityCount)
      ? clamp((input.amenityCount / 8) * 100, 0, 100)
      : null;
  components.push({ key: "amenityScore", score: amenityScore, weight: 0.12 });

  // Data confidence — null if neither signal present
  let dataConfidenceScore: number | null = null;
  if (input.confidenceScore != null && Number.isFinite(input.confidenceScore)) {
    dataConfidenceScore = Math.round(
      input.confidenceScore <= 1 ? input.confidenceScore * 100 : input.confidenceScore
    );
  } else if (
    input.dataCompletenessScore != null &&
    Number.isFinite(input.dataCompletenessScore)
  ) {
    dataConfidenceScore = Math.round(
      input.dataCompletenessScore <= 1
        ? input.dataCompletenessScore * 100
        : input.dataCompletenessScore
    );
  }
  components.push({ key: "dataConfidenceScore", score: dataConfidenceScore, weight: 0.13 });

  let weightedSum = 0;
  let weightTotal = 0;
  let known = 0;
  for (const c of components) {
    if (c.score != null) {
      weightedSum += c.score * c.weight;
      weightTotal += c.weight;
      known += 1;
    }
  }

  const overallScore =
    weightTotal > 0 ? Math.round(clamp(weightedSum / weightTotal, 0, 100)) : 0;
  const completeness = components.length > 0 ? known / components.length : 0;

  const roundOrNull = (n: number | null) => (n == null ? null : Math.round(n));

  return {
    overallScore,
    valueScore: roundOrNull(valueScore),
    comfortScore: roundOrNull(comfortScore),
    privacyScore: roundOrNull(privacyScore),
    socialScore: roundOrNull(socialWithQuiet),
    convenienceScore: roundOrNull(convenienceScore),
    freshmanFitScore: roundOrNull(freshmanFitScore),
    amenityScore: roundOrNull(amenityScore),
    dataConfidenceScore: dataConfidenceScore != null ? Math.round(dataConfidenceScore) : null,
    completeness,
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
