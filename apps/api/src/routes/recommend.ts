import { Router } from "express";
import { prisma } from "@dormscope/database";
import { rankDormsForQuiz, compareRecommendation } from "@dormscope/scoring";
import type { QuizAnswers } from "@dormscope/shared";
import { z } from "zod";

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
});

recommendRouter.post("/quiz", async (req, res) => {
  try {
    const quiz = quizSchema.parse(req.body) as QuizAnswers & { collegeSlug?: string };

    const dorms = await prisma.dorm.findMany({
      where: quiz.collegeSlug ? { college: { slug: quiz.collegeSlug } } : {},
      include: { college: true, dormScore: true },
      take: 100,
    });

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

    const ranked = rankDormsForQuiz(recommendable, quiz).slice(0, 10);
    res.json(ranked);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

recommendRouter.post("/compare-summary", async (req, res) => {
  try {
    const ids: string[] = req.body.ids ?? [];
    const dorms = await prisma.dorm.findMany({
      where: { id: { in: ids } },
      include: { college: true, dormScore: true },
    });
    const rec = compareRecommendation(
      dorms.map((d) => ({
        id: d.id,
        name: d.name,
        collegeName: d.college.name,
        yearlyCost: d.yearlyCost,
        socialVibe: d.socialVibe,
        dormScore: d.dormScore,
      }))
    );
    res.json({ summary: rec });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});
