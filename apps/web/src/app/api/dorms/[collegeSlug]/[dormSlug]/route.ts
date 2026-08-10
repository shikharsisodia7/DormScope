import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { mergeSources } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { collegeSlug: string; dormSlug: string } }
) {
  try {
    const college = await prisma.college.findUnique({ where: { slug: params.collegeSlug } });
    if (!college) return jsonError("College not found", 404);

    const dorm = await prisma.dorm.findUnique({
      where: { collegeId_slug: { collegeId: college.id, slug: params.dormSlug } },
      include: {
        college: true,
        dormScore: true,
        roomTypes: true,
        dormAmenities: { include: { amenity: true } },
        housingCosts: true,
        sources: {
          where: { isApproved: true },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            url: true,
            finalUrl: true,
            canonicalUrl: true,
            title: true,
            sourceType: true,
            isApproved: true,
            pageRole: true,
            createdAt: true,
          },
        },
        dormSources: {
          include: {
            source: {
              select: {
                id: true,
                url: true,
                finalUrl: true,
                canonicalUrl: true,
                title: true,
                sourceType: true,
                isApproved: true,
                pageRole: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        reviewSummaries: true,
        reviews: {
          where: { status: "APPROVED" },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            overallRating: true,
            categoryRatings: true,
            schoolYear: true,
            classYearLived: true,
            roomTypeLived: true,
            pros: true,
            cons: true,
            advice: true,
            body: true,
            createdAt: true,
            // no user PII
          },
        },
        fieldProvenance: {
          orderBy: { retrievalAt: "desc" },
          take: 50,
          include: { source: { select: { id: true, url: true, title: true, isApproved: true } } },
        },
      },
    });

    if (!dorm) return jsonError("Dorm not found", 404);

    const costAgg = await prisma.dorm.aggregate({
      where: { collegeId: college.id, yearlyCost: { not: null } },
      _avg: { yearlyCost: true },
    });

    const provenanceSummary = dorm.fieldProvenance.reduce<
      Record<string, { fieldName: string; confidence: number; sourceUrl?: string | null; verified: boolean }>
    >((acc, p) => {
      if (!acc[p.fieldName] || (p.confidence ?? 0) > (acc[p.fieldName].confidence ?? 0)) {
        acc[p.fieldName] = {
          fieldName: p.fieldName,
          confidence: p.confidence,
          sourceUrl: p.sourceUrl ?? p.source?.url,
          verified: p.verified,
        };
      }
      return acc;
    }, {});

    const mergedSources = mergeSources(dorm.sources, dorm.dormSources);

    return jsonOk({
      dorm: { ...dorm, sources: mergedSources },
      collegeAvgCost: costAgg._avg.yearlyCost ?? 0,
      provenanceSummary: Object.values(provenanceSummary),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
