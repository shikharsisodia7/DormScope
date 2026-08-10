import { randomBytes } from "crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "@dormscope/database";
import {
  ALGORITHM_VERSION,
  filterByHardConstraints,
  rankDormsForPreferences,
  type RankableDorm,
} from "@dormscope/scoring";
import type { HardConstraints, PreferenceProfile } from "@dormscope/shared";
import { asyncHandler } from "../middleware/errorHandler.js";

export const matchRouter = Router();

const matchSchema = z.object({
  collegeSlug: z.string().min(1),
  weights: z.record(z.number().min(0).max(4)).default({}),
  hardConstraints: z.record(z.union([z.boolean(), z.number(), z.null()])).default({}),
  spectrumValues: z.record(z.number()).optional(),
  toggles: z.record(z.boolean()).optional(),
  saveRun: z.boolean().optional(),
  shareToken: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

function toRankable(d: {
  id: string;
  name: string;
  yearlyCost: number | null;
  hasAC: boolean | null;
  bathroomStyle: string;
  dormType: string;
  freshmanEligible: boolean | null;
  upperclassEligible: boolean | null;
  honorsHousing: boolean | null;
  themedHousing: boolean | null;
  genderInclusive: boolean | null;
  substanceFree: boolean | null;
  elevatorAccess: boolean | null;
  laundryAccess: boolean | null;
  kitchenAccess: boolean | null;
  studyLounges: boolean | null;
  socialVibe: number | null;
  quietVibe: number | null;
  privacyRating: number | null;
  diningDistanceMeters: number | null;
  gymDistanceMeters: number | null;
  classroomDistanceMeters: number | null;
  confidenceScore: number;
  dataCompletenessScore: number;
  lastUpdatedAt: Date;
  wheelchairAccessible: boolean | null;
  livingLearning: boolean | null;
  college: { name: string };
  dormScore: RankableDorm["dormScore"];
  roomTypes: RankableDorm["roomTypes"];
  dormAmenities: Array<{ amenity: { normalized: string } }>;
}, collegeAvgCost: number | null): RankableDorm {
  return {
    id: d.id,
    name: d.name,
    collegeName: d.college.name,
    yearlyCost: d.yearlyCost,
    collegeAvgCost,
    hasAC: d.hasAC,
    bathroomStyle: d.bathroomStyle,
    dormType: d.dormType,
    freshmanEligible: d.freshmanEligible,
    upperclassEligible: d.upperclassEligible,
    honorsHousing: d.honorsHousing,
    themedHousing: d.themedHousing,
    genderInclusive: d.genderInclusive,
    substanceFree: d.substanceFree,
    accessible: d.wheelchairAccessible,
    elevatorAccess: d.elevatorAccess,
    laundryAccess: d.laundryAccess,
    kitchenAccess: d.kitchenAccess,
    studyLounges: d.studyLounges,
    isLivingLearning: d.livingLearning,
    socialVibe: d.socialVibe,
    quietVibe: d.quietVibe,
    privacyRating: d.privacyRating,
    diningDistanceMeters: d.diningDistanceMeters,
    gymDistanceMeters: d.gymDistanceMeters,
    classroomDistanceMeters: d.classroomDistanceMeters,
    confidenceScore: d.confidenceScore,
    dataCompletenessScore: d.dataCompletenessScore,
    lastUpdatedAt: d.lastUpdatedAt,
    dormScore: d.dormScore,
    roomTypes: d.roomTypes,
    amenityCount: d.dormAmenities.length || null,
  };
}

matchRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = matchSchema.parse(req.body);
    const college = await prisma.college.findUnique({ where: { slug: input.collegeSlug } });
    if (!college) return res.status(404).json({ error: "College not found" });

    const dorms = await prisma.dorm.findMany({
      where: { collegeId: college.id, isActive: true },
      include: {
        college: { select: { name: true } },
        dormScore: true,
        roomTypes: true,
        dormAmenities: { include: { amenity: true } },
      },
    });

    const avgAgg = await prisma.dorm.aggregate({
      where: { collegeId: college.id, yearlyCost: { not: null } },
      _avg: { yearlyCost: true },
    });

    const rankable = dorms.map((d) => toRankable(d, avgAgg._avg.yearlyCost));
    const profile: PreferenceProfile = {
      weights: input.weights,
      hardConstraints: input.hardConstraints as HardConstraints,
      spectrumValues: input.spectrumValues,
      toggles: input.toggles,
    };

    const { eligible, excluded } = filterByHardConstraints(rankable, profile.hardConstraints);
    const ranked = rankDormsForPreferences(eligible, profile, { limit: input.limit });

    let shareToken: string | undefined;
    let matchRunId: string | undefined;

    if (input.saveRun || input.shareToken) {
      shareToken = input.shareToken ? randomBytes(18).toString("base64url") : undefined;
      const run = await prisma.matchRun.create({
        data: {
          collegeId: college.id,
          weights: input.weights,
          hardConstraints: input.hardConstraints,
          algorithmVersion: ALGORITHM_VERSION,
          shareToken: shareToken ?? null,
          results: {
            create: [
              ...ranked.map((r, idx) => ({
                dormId: r.dorm.id,
                rank: idx + 1,
                matchScore: r.matchScore,
                confidence: r.confidence / 100,
                reasons: r.reasons as object,
                excluded: false,
                exclusionReasons: [],
              })),
              ...excluded.map((e) => ({
                dormId: e.dorm.id,
                rank: 0,
                matchScore: 0,
                confidence: 0,
                reasons: { positives: [], tradeoffs: [], unknowns: [] },
                excluded: true,
                exclusionReasons: e.reasons,
              })),
            ],
          },
        },
      });
      matchRunId = run.id;
    }

    res.json({
      college: { id: college.id, name: college.name, slug: college.slug },
      algorithmVersion: ALGORITHM_VERSION,
      matchRunId,
      shareToken,
      eligible: ranked.map((r) => ({
        dormId: r.dorm.id,
        name: r.dorm.name,
        matchScore: r.matchScore,
        confidence: r.confidence,
        confidenceLabel: r.confidenceLabel,
        reasons: r.reasons,
        dimensionScores: r.dimensionScores,
      })),
      excluded: excluded.map((e) => ({
        dormId: e.dorm.id,
        name: e.dorm.name,
        reasons: e.reasons,
      })),
    });
  })
);

matchRouter.get(
  "/:shareToken",
  asyncHandler(async (req, res) => {
    const run = await prisma.matchRun.findUnique({
      where: { shareToken: req.params.shareToken },
      include: {
        college: { select: { id: true, name: true, slug: true, city: true, state: true } },
        results: {
          include: {
            dorm: {
              select: {
                id: true,
                name: true,
                slug: true,
                yearlyCost: true,
                dormType: true,
                bathroomStyle: true,
                hasAC: true,
              },
            },
          },
          orderBy: [{ excluded: "asc" }, { rank: "asc" }],
        },
      },
    });

    if (!run) return res.status(404).json({ error: "Match run not found" });

    res.json({
      id: run.id,
      shareToken: run.shareToken,
      algorithmVersion: run.algorithmVersion,
      createdAt: run.createdAt,
      college: run.college,
      weights: run.weights,
      hardConstraints: run.hardConstraints,
      eligible: run.results
        .filter((r) => !r.excluded)
        .map((r) => ({
          dormId: r.dormId,
          rank: r.rank,
          matchScore: r.matchScore,
          confidence: r.confidence,
          reasons: r.reasons,
          dorm: r.dorm,
        })),
      excluded: run.results
        .filter((r) => r.excluded)
        .map((r) => ({
          dormId: r.dormId,
          reasons: r.exclusionReasons,
          dorm: r.dorm,
        })),
    });
  })
);
