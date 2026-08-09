import { prisma } from "@/lib/prisma";
import { jsonOk, handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const reports = await prisma.dataQualityReport.findMany({
      include: { college: { select: { name: true, slug: true, state: true } } },
      orderBy: { generatedAt: "desc" },
      take: 50,
    });

    const missingCost = await prisma.dorm.count({ where: { yearlyCost: null } });
    const missingAmenities = await prisma.dorm.count({
      where: { dormAmenities: { none: {} } },
    });
    const lowConfidence = await prisma.dorm.count({ where: { confidenceScore: { lt: 0.6 } } });

    return jsonOk({ reports, missingCost, missingAmenities, lowConfidence });
  } catch (err) {
    return handleRouteError(err);
  }
}
