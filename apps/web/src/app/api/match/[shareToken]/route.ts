import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { shareToken: string } }) {
  try {
    const run = await prisma.matchRun.findUnique({
      where: { shareToken: params.shareToken },
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

    if (!run) return jsonError("Match run not found", 404);

    // No PII: omit profile/user linkage
    return jsonOk({
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
  } catch (err) {
    return handleRouteError(err);
  }
}
