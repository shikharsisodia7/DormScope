import { prisma } from "@/lib/prisma";
import { jsonOk, handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const stateFilter = searchParams.get("state") ?? undefined;

    const dorms = await prisma.dorm.findMany({
      where: stateFilter ? { college: { state: stateFilter } } : {},
      include: { college: { select: { state: true, schoolType: true } } },
    });

    const byState: Record<
      string,
      { costs: number[]; count: number; ac: number; suite: number; freshman: number }
    > = {};

    for (const d of dorms) {
      const st = d.college.state;
      if (!byState[st]) byState[st] = { costs: [], count: 0, ac: 0, suite: 0, freshman: 0 };
      byState[st].count++;
      if (d.yearlyCost) byState[st].costs.push(d.yearlyCost);
      if (d.hasAC) byState[st].ac++;
      if (d.bathroomStyle === "SUITE") byState[st].suite++;
      if (d.dormType === "FRESHMAN_ONLY" || (d.freshmanEligible && !d.upperclassEligible)) {
        byState[st].freshman++;
      }
    }

    const stateStats = Object.entries(byState).map(([state, data]) => ({
      state,
      avgCost: data.costs.length
        ? Math.round(data.costs.reduce((a, b) => a + b, 0) / data.costs.length)
        : 0,
      dormCount: data.count,
      acPercent: data.count ? Math.round((data.ac / data.count) * 100) : 0,
      suitePercent: data.count ? Math.round((data.suite / data.count) * 100) : 0,
      freshmanPercent: data.count ? Math.round((data.freshman / data.count) * 100) : 0,
    }));

    const total = dorms.length || 1;
    const publicCosts = dorms
      .filter((d) => d.college.schoolType === "PUBLIC" && d.yearlyCost)
      .map((d) => d.yearlyCost!);
    const privateCosts = dorms
      .filter((d) => d.college.schoolType === "PRIVATE" && d.yearlyCost)
      .map((d) => d.yearlyCost!);

    const bathroomDist = ["COMMUNAL", "SUITE", "PRIVATE", "UNKNOWN"].map((b) => ({
      name: b,
      count: dorms.filter((d) => d.bathroomStyle === b).length,
    }));

    const roomTypes = await prisma.roomType.groupBy({
      by: ["normalized"],
      _count: true,
      orderBy: { _count: { normalized: "desc" } },
      take: 8,
    });

    const scores = await prisma.dormScore.findMany({ select: { overallScore: true } });
    const dist = [0, 20, 40, 60, 80].map((min) => ({
      range: `${min}-${min + 19}`,
      count: scores.filter(
        (s) => s.overallScore != null && s.overallScore >= min && s.overallScore < min + 20
      ).length,
    }));

    return jsonOk({
      totals: {
        dorms: dorms.length,
        withAC: Math.round((dorms.filter((d) => d.hasAC).length / total) * 100),
        suiteBathrooms: Math.round(
          (dorms.filter((d) => d.bathroomStyle === "SUITE").length / total) * 100
        ),
        freshmanOnly: Math.round(
          (dorms.filter((d) => d.dormType === "FRESHMAN_ONLY").length / total) * 100
        ),
      },
      stateStats: stateStats.sort((a, b) => b.avgCost - a.avgCost),
      publicAvgCost: publicCosts.length
        ? Math.round(publicCosts.reduce((a, b) => a + b, 0) / publicCosts.length)
        : 0,
      privateAvgCost: privateCosts.length
        ? Math.round(privateCosts.reduce((a, b) => a + b, 0) / privateCosts.length)
        : 0,
      bathroomDist,
      roomTypes: roomTypes.map((r) => ({ name: r.normalized, count: r._count })),
      scoreDistribution: dist,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
