import type { QuizAnswers } from "@dormscope/shared";

export interface RecommendableDorm {
  id: string;
  name: string;
  collegeName: string;
  yearlyCost?: number | null;
  hasAC?: boolean | null;
  bathroomStyle?: string;
  dormType?: string;
  freshmanEligible?: boolean;
  honorsHousing?: boolean;
  socialVibe?: number | null;
  quietVibe?: number | null;
  studyLounges?: boolean | null;
  kitchenAccess?: boolean | null;
  diningDistanceMeters?: number | null;
  dormScore?: {
    overallScore: number;
    valueScore: number;
    comfortScore: number;
    privacyScore: number;
    socialScore: number;
    convenienceScore: number;
    freshmanFitScore: number;
  } | null;
}

export interface RankedRecommendation {
  dorm: RecommendableDorm;
  matchScore: number;
  explanation: string;
}

export function rankDormsForQuiz(dorms: RecommendableDorm[], quiz: QuizAnswers): RankedRecommendation[] {
  const weights = {
    price: quiz.priorityPrice / 10,
    comfort: quiz.priorityComfort / 10,
    privacy: quiz.priorityPrivacy / 10,
    location: quiz.priorityLocation / 10,
  };

  const ranked = dorms.map((dorm) => {
    const s = dorm.dormScore;
    let match = 0;
    let maxW = 0;

    if (s) {
      match += s.valueScore * weights.price;
      maxW += 100 * weights.price;
      match += s.comfortScore * weights.comfort;
      maxW += 100 * weights.comfort;
      match += s.privacyScore * weights.privacy;
      maxW += 100 * weights.privacy;
      match += s.convenienceScore * weights.location;
      maxW += 100 * weights.location;
    }

    if (quiz.isFreshman && dorm.freshmanEligible) match += 15;
    else if (quiz.isFreshman && !dorm.freshmanEligible) match -= 30;

    if (quiz.prefersSocial && (dorm.socialVibe ?? 0) >= 7) match += 12;
    if (quiz.prefersQuiet && (dorm.quietVibe ?? 0) >= 7) match += 12;

    if (quiz.wantsAC && dorm.hasAC) match += 10;
    else if (quiz.wantsAC && !dorm.hasAC) match -= 20;

    const bath = (dorm.bathroomStyle ?? "").toLowerCase();
    if (quiz.bathroomPreference === "communal" && bath.includes("communal")) match += 8;
    if (quiz.bathroomPreference === "suite" && bath.includes("suite")) match += 10;
    if (quiz.bathroomPreference === "private" && bath.includes("private")) match += 12;

    if (quiz.nearDining && (dorm.diningDistanceMeters ?? 9999) < 400) match += 8;
    if (quiz.apartmentStyle && dorm.dormType === "APARTMENT") match += 15;
    if (quiz.honorsThemed && dorm.honorsHousing) match += 12;
    if (quiz.studyLounges && dorm.studyLounges) match += 6;

    if (quiz.cheapestVsBestFit === "cheapest" && dorm.yearlyCost) {
      const costBonus = Math.max(0, 25 - dorm.yearlyCost / 1000);
      match += costBonus;
    } else if (quiz.cheapestVsBestFit === "best_fit" && s) {
      match += s.overallScore * 0.2;
    }

    maxW += 80;
    const matchScore = maxW > 0 ? Math.min(100, Math.round((match / maxW) * 100)) : 50;

    return {
      dorm,
      matchScore,
      explanation: buildExplanation(dorm, quiz, matchScore),
    };
  });

  return ranked.sort((a, b) => b.matchScore - a.matchScore);
}

function buildExplanation(dorm: RecommendableDorm, quiz: QuizAnswers, score: number): string {
  const parts: string[] = [];
  if (score >= 75) parts.push(`Strong match (${score}%)`);
  else if (score >= 55) parts.push(`Good fit (${score}%)`);
  else parts.push(`Moderate fit (${score}%)`);

  if (quiz.isFreshman && dorm.freshmanEligible) parts.push("works for freshmen");
  if (quiz.prefersSocial && (dorm.socialVibe ?? 0) >= 7) parts.push("social environment");
  if (quiz.prefersQuiet && (dorm.quietVibe ?? 0) >= 7) parts.push("quieter vibe");
  if (quiz.wantsAC && dorm.hasAC) parts.push("has AC");
  if (quiz.apartmentStyle && dorm.dormType === "APARTMENT") parts.push("apartment-style independence");

  return `${dorm.name} at ${dorm.collegeName}: ${parts.join(", ")}.`;
}

export function compareRecommendation(dorms: RecommendableDorm[]): string {
  if (dorms.length < 2) return "Add more dorms to compare.";
  const [a, b] = dorms;
  const sa = a.dormScore?.overallScore ?? 0;
  const sb = b.dormScore?.overallScore ?? 0;
  const costA = a.yearlyCost ?? 0;
  const costB = b.yearlyCost ?? 0;

  const lines: string[] = [];
  if ((a.socialVibe ?? 0) > (b.socialVibe ?? 0) + 1) {
    lines.push(`${a.name} is better if you want a more social experience.`);
  } else if ((b.socialVibe ?? 0) > (a.socialVibe ?? 0) + 1) {
    lines.push(`${b.name} is better if you want a more social experience.`);
  }
  if (costA < costB * 0.95) lines.push(`${a.name} is better for lower cost.`);
  else if (costB < costA * 0.95) lines.push(`${b.name} is better for lower cost.`);
  if ((a.dormScore?.privacyScore ?? 0) > (b.dormScore?.privacyScore ?? 0) + 10) {
    lines.push(`${a.name} offers more privacy (bathrooms/room style).`);
  } else if ((b.dormScore?.privacyScore ?? 0) > (a.dormScore?.privacyScore ?? 0) + 10) {
    lines.push(`${b.name} offers more privacy.`);
  }
  if (sa > sb + 5) lines.push(`${a.name} ranks higher overall on DormScope Score.`);
  else if (sb > sa + 5) lines.push(`${b.name} ranks higher overall on DormScope Score.`);

  return lines.length ? lines.join(" ") : "Both dorms are fairly similar — choose based on cost vs. social vibe.";
}
