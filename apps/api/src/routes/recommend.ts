import { Router } from "express";
import { prisma } from "@dormscope/database";
import {
  rankDormsForQuiz,
  compareRecommendation,
  rankDormsForPreferences,
  ALGORITHM_VERSION,
  type RankableDorm,
} from "@dormscope/scoring";
import type { HardConstraints, PreferenceProfile, QuizAnswers } from "@dormscope/shared";
import { z } from "zod";
import { asyncHandler } from "../middleware/errorHandler.js";

export const recommendRouter = Router();

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

recommendRouter.post(
  "/quiz",
  asyncHandler(async (req, res) => {
    const quiz = quizSchema.parse(req.body) as QuizAnswers & {
      collegeSlug?: string;
      usePersonalized?: boolean;
    };

    const dorms = await prisma.dorm.findMany({
      where: quiz.collegeSlug
        ? { college: { slug: quiz.collegeSlug }, isActive: true }
        : { isActive: true },
      include: {
        college: true,
        dormScore: true,
        roomTypes: true,
        dormAmenities: { include: { amenity: true } },
      },
      take: 100,
    });

    if (quiz.usePersonalized !== false) {
      const withCost = dorms.filter((d) => d.yearlyCost != null);
      const avg =
        withCost.reduce((s, d) => s + (d.yearlyCost ?? 0), 0) / (withCost.length || 1);

      const rankable: RankableDorm[] = dorms.map((d) => ({
        id: d.id,
        name: d.name,
        collegeName: d.college.name,
        yearlyCost: d.yearlyCost,
        collegeAvgCost: avg || null,
        hasAC: d.hasAC,
        bathroomStyle: d.bathroomStyle,
        dormType: d.dormType,
        freshmanEligible: d.freshmanEligible,
        upperclassEligible: d.upperclassEligible,
        honorsHousing: d.honorsHousing,
        themedHousing: d.themedHousing,
        genderInclusive: d.genderInclusive,
        elevatorAccess: d.elevatorAccess,
        laundryAccess: d.laundryAccess,
        kitchenAccess: d.kitchenAccess,
        studyLounges: d.studyLounges,
        socialVibe: d.socialVibe,
        quietVibe: d.quietVibe,
        diningDistanceMeters: d.diningDistanceMeters,
        dormScore: d.dormScore,
        roomTypes: d.roomTypes,
        confidenceScore: d.confidenceScore,
        dataCompletenessScore: d.dataCompletenessScore,
        amenityCount: d.dormAmenities.length || null,
      }));

      const ranked = rankDormsForPreferences(rankable, quizToProfile(quiz), { limit: 10 });
      return res.json(
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

    res.json(rankDormsForQuiz(recommendable, quiz).slice(0, 10));
  })
);

recommendRouter.post(
  "/compare-summary",
  asyncHandler(async (req, res) => {
    const ids: string[] = z.array(z.string()).min(1).max(4).parse(req.body.ids ?? []);
    const dorms = await prisma.dorm.findMany({
      where: { id: { in: ids } },
      include: { college: true, dormScore: true },
    });
    const summary = compareRecommendation(
      dorms.map((d) => ({
        id: d.id,
        name: d.name,
        collegeName: d.college.name,
        yearlyCost: d.yearlyCost,
        socialVibe: d.socialVibe,
        dormScore: d.dormScore,
      }))
    );
    res.json({ summary });
  })
);
