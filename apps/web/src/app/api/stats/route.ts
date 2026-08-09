import { prisma } from "@/lib/prisma";
import { jsonOk, handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [colleges, dorms, sources, confidence, states] = await Promise.all([
      prisma.college.count(),
      prisma.dorm.count(),
      prisma.source.count(),
      prisma.dorm.aggregate({ _avg: { confidenceScore: true } }),
      prisma.college.findMany({ select: { state: true }, distinct: ["state"] }),
    ]);

    return jsonOk({
      totalColleges: colleges,
      totalDorms: dorms,
      totalSources: sources,
      avgConfidence: Math.round((confidence._avg.confidenceScore ?? 0) * 100),
      statesCovered: states.length,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
