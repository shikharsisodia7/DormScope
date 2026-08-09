import { z } from "zod";
import { rankDormsForQuiz, rankDormsForPreferences, ALGORITHM_VERSION } from "@dormscope/scoring";
import type { HardConstraints, PreferenceProfile, QuizAnswers } from "@dormscope/shared";
import { prisma } from "@/lib/prisma";
import { jsonOk, handleRouteError } from "@/lib/api";
import { toRankableDorm } from "@/lib/match-helpers";

export const dynamic = "force-dynamic";

const quizSchema = z.object({
  isFreshman: z.boolean(),
  prefersSocial: z.boolean(),
  prefersQuiet: z.boolean(),
  priorityPrice: z.number().min(0).max(10),
  priorityComfort: z.number().min(0).max(10),
  priorityPrivacy: z.number().min(0).max(10),
  priorityLocation: z.number().min(0).max(10),
  wantsAC: z.boolean(),
  bathroomPreference: z.enum(["communal", "suite", "private"]),
  nearDining: z.boolean(),
  apartmentStyle: z.boolean(),
  honorsThemed: z.boolean(),
  studyLounges: z.boolean(),
  cheapestVsBestFit: z.enum(["cheapest", "best_fit"]),
  collegeSlug: z.string().optional(),
  /** When true, also run personalizedRanker using mapped weights */
  usePersonalized: z.boolean().optional(),
});

function quizToProfile(quiz: QuizAnswers): PreferenceProfile {
  const weights: Record<string, number> = {
    cost: quiz.priorityPrice / 2.5,
    comfort: quiz.priorityComfort / 2.5,
    privacy: quiz.priorityPrivacy / 2.5,
    location: quiz.priorityLocation / 2.5,
    socialAtmosphere: quiz.prefersSocial ? 3 : 1,
    quietAtmosphere: quiz.prefersQuiet ? 3 : 1,
    airConditioning: quiz.wantsAC ? 3 : 0,
    studyEnvironment: quiz.studyLounges ? 3 : 1,
    apartmentIndependence: quiz.apartmentStyle ? 3 : 0,
    livingLearning: quiz.honorsThemed ? 3 : 0,
    value: quiz.cheapestVsBestFit === "cheapest" ? 4 : 2,
  };

  const hardConstraints: HardConstraints = {};
  if (quiz.isFreshman) hardConstraints.requireFreshmanEligible = true;
  if (quiz.wantsAC) hardConstraints.requireAC = true;
  if (quiz.bathroomPreference === "private") hardConstraints.requirePrivateBath = true;
  if (quiz.bathroomPreference === "suite") hardConstraints.requirePrivateOrSuiteBath = true;

  return { weights, hardConstraints };
}

export async function POST(req: Request) {
  try {
    const quiz = quizSchema.parse(await req.json()) as QuizAnswers & {
      collegeSlug?: string;
      usePersonalized?: boolean;
    };

    const dorms = await prisma.dorm.findMany({
      where: quiz.collegeSlug ? { college: { slug: quiz.collegeSlug }, isActive: true } : { isActive: true },
      include: {
        college: true,
        dormScore: true,
        roomTypes: true,
        dormAmenities: { include: { amenity: true } },
      },
      take: 100,
    });

    if (quiz.usePersonalized !== false) {
      const avg =
        dorms.filter((d) => d.yearlyCost != null).reduce((s, d) => s + (d.yearlyCost ?? 0), 0) /
        (dorms.filter((d) => d.yearlyCost != null).length || 1);
      const rankable = dorms.map((d) => toRankableDorm(d, avg || null));
      const ranked = rankDormsForPreferences(rankable, quizToProfile(quiz), { limit: 10 });
      return jsonOk(
        ranked.map((r) => ({
          ...r.dorm,
          matchScore: r.matchScore,
          confidence: r.confidence,
          confidenceLabel: r.confidenceLabel,
          reasons: r.reasons,
          algorithmVersion: ALGORITHM_VERSION,
        }))
      );
    }

    const recommendable = dorms.map((d) => ({
      id: d.id,
      name: d.name,
      collegeName: d.college.name,
      yearlyCost: d.yearlyCost,
      hasAC: d.hasAC,
      bathroomStyle: d.bathroomStyle,
      dormType: d.dormType,
      freshmanEligible: d.freshmanEligible,
      honorsHousing: d.honorsHousing,
      socialVibe: d.socialVibe,
      quietVibe: d.quietVibe,
      studyLounges: d.studyLounges,
      kitchenAccess: d.kitchenAccess,
      diningDistanceMeters: d.diningDistanceMeters,
      dormScore: d.dormScore,
    }));

    return jsonOk(rankDormsForQuiz(recommendable, quiz).slice(0, 10));
  } catch (err) {
    return handleRouteError(err);
  }
}
