import { fuzzyDormNameMatch } from "@dormscope/shared";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError, handleRouteError, requireAdminKey } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // Read overview can optionally require admin; require key when configured
    if (process.env.ADMIN_API_KEY && !requireAdminKey(req)) {
      return jsonError("Unauthorized", 401);
    }

    const [
      colleges,
      dorms,
      sources,
      jobs,
      avgConf,
      missingCost,
      missingAmenities,
      failedJobs,
      stale,
    ] = await Promise.all([
      prisma.college.count(),
      prisma.dorm.count(),
      prisma.source.count(),
      prisma.scrapeJob.count(),
      prisma.dorm.aggregate({ _avg: { confidenceScore: true, dataCompletenessScore: true } }),
      prisma.dorm.count({ where: { yearlyCost: null } }),
      prisma.dorm.count({ where: { dormAmenities: { none: {} } } }),
      prisma.scrapeJob.count({ where: { status: "FAILED" } }),
      prisma.dorm.count({
        where: { lastUpdatedAt: { lt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) } },
      }),
    ]);

    const successJobs = await prisma.scrapeJob.count({ where: { status: "COMPLETED" } });
    const scrapeSuccessRate = jobs ? Math.round((successJobs / jobs) * 100) : 0;

    const allDorms = await prisma.dorm.findMany({
      select: { id: true, name: true, collegeId: true },
      take: 500,
    });
    const duplicateWarnings: { a: string; b: string; score: number }[] = [];
    for (let i = 0; i < allDorms.length; i++) {
      for (let j = i + 1; j < allDorms.length; j++) {
        if (allDorms[i].collegeId !== allDorms[j].collegeId) continue;
        const score = fuzzyDormNameMatch(allDorms[i].name, allDorms[j].name);
        if (score >= 0.85 && score < 1) {
          duplicateWarnings.push({ a: allDorms[i].name, b: allDorms[j].name, score });
          if (duplicateWarnings.length >= 20) break;
        }
      }
      if (duplicateWarnings.length >= 20) break;
    }

    return jsonOk({
      colleges,
      dorms,
      sources,
      scrapeSuccessRate,
      avgConfidence: Math.round((avgConf._avg.confidenceScore ?? 0) * 100),
      avgCompleteness: Math.round((avgConf._avg.dataCompletenessScore ?? 0) * 100),
      missingCost,
      missingAmenities,
      duplicateWarnings,
      staleRecords: stale,
      failedJobs,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
