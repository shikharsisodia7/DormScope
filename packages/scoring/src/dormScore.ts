export interface DormScoreInput {
  yearlyCost?: number | null;
  collegeAvgCost?: number;
  hasAC?: boolean | null;
  bathroomStyle?: string;
  privacyRating?: number | null;
  socialVibe?: number | null;
  quietVibe?: number | null;
  freshmanEligible?: boolean;
  amenityCount?: number;
  diningDistanceMeters?: number | null;
  confidenceScore?: number;
  dataCompletenessScore?: number;
}

export interface ComputedDormScore {
  overallScore: number;
  valueScore: number;
  comfortScore: number;
  privacyScore: number;
  socialScore: number;
  convenienceScore: number;
  freshmanFitScore: number;
  amenityScore: number;
  dataConfidenceScore: number;
  breakdown: Record<string, number>;
}

export function computeDormScore(input: DormScoreInput): ComputedDormScore {
  const cost = input.yearlyCost ?? 15000;
  const avg = input.collegeAvgCost ?? cost;
  const valueScore = Math.min(100, Math.max(0, 100 - ((cost - avg * 0.8) / avg) * 80));

  let comfortScore = 50;
  if (input.hasAC) comfortScore += 25;
  if (input.bathroomStyle === "PRIVATE") comfortScore += 25;
  else if (input.bathroomStyle === "SUITE") comfortScore += 15;
  comfortScore = Math.min(100, comfortScore);

  const privacyScore =
    input.privacyRating != null
      ? input.privacyRating * 10
      : input.bathroomStyle === "PRIVATE"
        ? 90
        : input.bathroomStyle === "SUITE"
          ? 65
          : 35;

  const socialScore = Math.min(100, (input.socialVibe ?? 5) * 10);
  const quietBonus = (input.quietVibe ?? 5) > 7 ? 10 : 0;

  let convenienceScore = 60;
  if ((input.diningDistanceMeters ?? 500) < 300) convenienceScore += 25;
  else if ((input.diningDistanceMeters ?? 500) < 600) convenienceScore += 15;
  convenienceScore = Math.min(100, convenienceScore);

  const freshmanFitScore = input.freshmanEligible ? 85 : 45;
  const amenityScore = Math.min(100, ((input.amenityCount ?? 3) / 8) * 100);
  const dataConfidenceScore = Math.round((input.confidenceScore ?? 0.5) * 100);

  const overallScore = Math.round(
    valueScore * 0.15 +
      comfortScore * 0.15 +
      privacyScore * 0.12 +
      (socialScore + quietBonus) * 0.1 +
      convenienceScore * 0.1 +
      freshmanFitScore * 0.13 +
      amenityScore * 0.12 +
      dataConfidenceScore * 0.13
  );

  return {
    overallScore: Math.min(100, Math.max(0, overallScore)),
    valueScore: Math.round(valueScore),
    comfortScore: Math.round(comfortScore),
    privacyScore: Math.round(privacyScore),
    socialScore: Math.round(socialScore),
    convenienceScore: Math.round(convenienceScore),
    freshmanFitScore: Math.round(freshmanFitScore),
    amenityScore: Math.round(amenityScore),
    dataConfidenceScore,
    breakdown: {
      valueScore,
      comfortScore,
      privacyScore,
      socialScore,
      convenienceScore,
      freshmanFitScore,
      amenityScore,
      dataConfidenceScore,
    },
  };
}

export function explainScore(score: ComputedDormScore): string[] {
  const lines: string[] = [];
  if (score.valueScore >= 70) lines.push("Strong value relative to typical costs at this school.");
  else if (score.valueScore < 45) lines.push("Higher cost than many peers — comfort and amenities may justify it.");
  if (score.comfortScore >= 75) lines.push("Comfort features like AC and bathroom style boost this score.");
  if (score.privacyScore >= 70) lines.push("Better privacy — suite or private bathrooms, or high privacy rating.");
  if (score.socialScore >= 75) lines.push("Known as a social dorm — good if you want to meet people.");
  if (score.freshmanFitScore >= 80) lines.push("Especially suitable for first-year students.");
  if (score.dataConfidenceScore < 60) lines.push("Some data is uncertain — verify on the official housing site.");
  return lines;
}
