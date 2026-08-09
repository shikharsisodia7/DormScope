import { z } from "zod";
import { ALGORITHM_VERSION, filterByHardConstraints, rankDormsForPreferences } from "@dormscope/scoring";
import type { HardConstraints, PreferenceProfile } from "@dormscope/shared";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError, handleRouteError, randomShareToken } from "@/lib/api";
import { toRankableDorm } from "@/lib/match-helpers";

export const dynamic = "force-dynamic";

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

export async function POST(req: Request) {
  try {
    const input = matchSchema.parse(await req.json());

    const college = await prisma.college.findUnique({ where: { slug: input.collegeSlug } });
    if (!college) return jsonError("College not found", 404);

    const dorms = await prisma.dorm.findMany({
      where: { collegeId: college.id, isActive: true },
      include: {
        college: { select: { name: true } },
        dormScore: true,
        roomTypes: true,
        dormAmenities: { include: { amenity: true } },
      },
    });

    const costAgg = await prisma.dorm.aggregate({
      where: { collegeId: college.id, yearlyCost: { not: null } },
      _avg: { yearlyCost: true },
    });
    const collegeAvgCost = costAgg._avg.yearlyCost;

    const rankable = dorms.map((d) => toRankableDorm(d, collegeAvgCost));
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
      shareToken = input.shareToken ? randomShareToken() : undefined;
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

    return jsonOk({
      college: { id: college.id, name: college.name, slug: college.slug },
      algorithmVersion: ALGORITHM_VERSION,
      matchRunId,
      shareToken,
      eligible: ranked.map((r) => ({
        dormId: r.dorm.id,
        name: r.dorm.name,
        slug: r.dorm.slug,
        matchScore: r.matchScore,
        confidence: r.confidence,
        confidenceLabel: r.confidenceLabel,
        reasons: r.reasons,
        dimensionScores: r.dimensionScores,
      })),
      excluded: excluded.map((e) => ({
        dormId: e.dorm.id,
        name: e.dorm.name,
        slug: e.dorm.slug,
        reasons: e.reasons,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
