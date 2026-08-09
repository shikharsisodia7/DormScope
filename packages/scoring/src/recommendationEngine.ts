import type { PreferenceProfile, QuizAnswers } from "@dormscope/shared";
import { PreferenceImportance } from "@dormscope/shared";
import {
  rankDormsForPreferences,
  type RankableDorm,
  type RankedMatch,
} from "./personalizedRanker";

export interface RecommendableDorm extends RankableDorm {
  collegeName: string;
}

export interface RankedRecommendation {
  dorm: RecommendableDorm;
  matchScore: number;
  explanation: string;
  /** Present when ranking via personalized engine */
  confidence?: number;
  reasons?: RankedMatch["reasons"];
}

/**
 * Map legacy quiz answers into a PreferenceProfile for the personalized ranker.
 */
export function quizAnswersToPreferenceProfile(quiz: QuizAnswers): PreferenceProfile {
  const weights: PreferenceProfile["weights"] = {
    affordability: Math.round(quiz.priorityPrice / 2.5) as number,
    airConditioning: quiz.wantsAC ? PreferenceImportance.VERY : PreferenceImportance.IRRELEVANT,
    privacy: Math.round(quiz.priorityPrivacy / 2.5) as number,
    location: Math.round(quiz.priorityLocation / 2.5) as number,
    proximityDining: quiz.nearDining ? PreferenceImportance.IMPORTANT : PreferenceImportance.SOMEWHAT,
    socialAtmosphere: quiz.prefersSocial ? PreferenceImportance.VERY : PreferenceImportance.IRRELEVANT,
    quietAtmosphere: quiz.prefersQuiet ? PreferenceImportance.VERY : PreferenceImportance.IRRELEVANT,
    apartmentStyle: quiz.apartmentStyle ? PreferenceImportance.VERY : PreferenceImportance.IRRELEVANT,
    livingLearning: quiz.honorsThemed ? PreferenceImportance.IMPORTANT : PreferenceImportance.IRRELEVANT,
    studyEnvironment: quiz.studyLounges ? PreferenceImportance.IMPORTANT : PreferenceImportance.IRRELEVANT,
    overallSatisfaction:
      quiz.cheapestVsBestFit === "best_fit"
        ? PreferenceImportance.IMPORTANT
        : PreferenceImportance.SOMEWHAT,
    bathroomPrivacy: PreferenceImportance.IMPORTANT,
  };

  // Soft bathroom preference
  if (quiz.bathroomPreference === "private") {
    weights.privateBathroom = PreferenceImportance.VERY;
  } else if (quiz.bathroomPreference === "suite") {
    weights.suiteBathroom = PreferenceImportance.VERY;
  } else if (quiz.bathroomPreference === "communal") {
    weights.communalBathroomOk = PreferenceImportance.IMPORTANT;
  }

  // Comfort priority spreads to comfort-related dims
  const comfortW = Math.round(quiz.priorityComfort / 2.5);
  weights.cleanliness = comfortW;
  weights.roomSpaciousness = comfortW;

  if (quiz.cheapestVsBestFit === "cheapest") {
    weights.affordability = PreferenceImportance.MUST;
  }

  const hardConstraints: PreferenceProfile["hardConstraints"] = {};
  if (quiz.isFreshman) {
    hardConstraints.requireFreshmanEligible = true;
  }
  if (quiz.wantsAC) {
    // Soft preference for AC via weights; do not hard-require unless must
  }

  return {
    weights,
    hardConstraints,
    toggles: {
      communalBathroomOk: quiz.bathroomPreference === "communal",
    },
  };
}

function buildExplanationFromMatch(match: RankedMatch<RecommendableDorm>): string {
  const { dorm, matchScore, reasons } = match;
  const parts: string[] = [];
  if (matchScore >= 75) parts.push(`Strong match (${matchScore}%)`);
  else if (matchScore >= 55) parts.push(`Good fit (${matchScore}%)`);
  else parts.push(`Moderate fit (${matchScore}%)`);

  if (reasons.positives.length) {
    parts.push(reasons.positives.slice(0, 2).join("; "));
  }
  if (reasons.tradeoffs.length) {
    parts.push(`tradeoff: ${reasons.tradeoffs[0]}`);
  }

  return `${dorm.name} at ${dorm.collegeName}: ${parts.join(" — ")}.`;
}

/**
 * Backwards-compatible quiz ranking — delegates to personalizedRanker.
 */
export function rankDormsForQuiz(
  dorms: RecommendableDorm[],
  quiz: QuizAnswers
): RankedRecommendation[] {
  const profile = quizAnswersToPreferenceProfile(quiz);
  const ranked = rankDormsForPreferences(dorms, profile);

  return ranked.map((match) => ({
    dorm: match.dorm,
    matchScore: match.matchScore,
    explanation: buildExplanationFromMatch(match),
    confidence: match.confidence,
    reasons: match.reasons,
  }));
}

export function compareRecommendation(dorms: RecommendableDorm[]): string {
  if (dorms.length < 2) return "Add more dorms to compare.";
  const [a, b] = dorms;
  const sa = a.dormScore?.overallScore ?? a.overallScore ?? null;
  const sb = b.dormScore?.overallScore ?? b.overallScore ?? null;
  const costA = a.yearlyCost;
  const costB = b.yearlyCost;

  const lines: string[] = [];

  if (a.socialVibe != null && b.socialVibe != null) {
    if (a.socialVibe > b.socialVibe + 1) {
      lines.push(`${a.name} is better if you want a more social experience.`);
    } else if (b.socialVibe > a.socialVibe + 1) {
      lines.push(`${b.name} is better if you want a more social experience.`);
    }
  }

  if (costA != null && costB != null) {
    if (costA < costB * 0.95) lines.push(`${a.name} is better for lower cost.`);
    else if (costB < costA * 0.95) lines.push(`${b.name} is better for lower cost.`);
  }

  const privA = a.dormScore?.privacyScore ?? a.privacyRating ?? null;
  const privB = b.dormScore?.privacyScore ?? b.privacyRating ?? null;
  if (privA != null && privB != null) {
    if (privA > privB + 10) {
      lines.push(`${a.name} offers more privacy (bathrooms/room style).`);
    } else if (privB > privA + 10) {
      lines.push(`${b.name} offers more privacy.`);
    }
  }

  if (sa != null && sb != null) {
    if (sa > sb + 5) lines.push(`${a.name} ranks higher overall on DormScope Score.`);
    else if (sb > sa + 5) lines.push(`${b.name} ranks higher overall on DormScope Score.`);
  }

  return lines.length
    ? lines.join(" ")
    : "Both dorms are fairly similar — choose based on cost vs. social vibe.";
}
