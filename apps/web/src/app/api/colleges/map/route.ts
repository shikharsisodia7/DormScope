import { prisma } from "@/lib/prisma";
import { jsonOk, handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(5000, Math.max(1, Number(searchParams.get("limit") ?? 2000) || 2000));

    const colleges = await prisma.college.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        state: true,
        latitude: true,
        longitude: true,
        schoolType: true,
        hasResidentialHousing: true,
        housingCoverageStatus: true,
        _count: { select: { dorms: true } },
      },
      take: limit,
      orderBy: { name: "asc" },
    });

    // Aggregate avg cost in a single groupBy to avoid loading every dorm row
    const costAgg = await prisma.dorm.groupBy({
      by: ["collegeId"],
      where: {
        collegeId: { in: colleges.map((c) => c.id) },
        yearlyCost: { not: null },
      },
      _avg: { yearlyCost: true },
    });
    const avgByCollege = new Map(costAgg.map((r) => [r.collegeId, r._avg.yearlyCost]));

    const pins = colleges.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      city: c.city,
      state: c.state,
      lat: c.latitude,
      lng: c.longitude,
      dormCount: c._count.dorms,
      avgCost: avgByCollege.get(c.id) ?? null,
      hasResidentialHousing: c.hasResidentialHousing,
      housingCoverageStatus: c.housingCoverageStatus,
    }));

    return jsonOk(pins);
  } catch (err) {
    return handleRouteError(err);
  }
}
