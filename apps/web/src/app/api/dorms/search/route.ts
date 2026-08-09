import { Prisma } from "@dormscope/database";
import { prisma } from "@/lib/prisma";
import { jsonOk, handleRouteError, parsePagination, normalizeSearchQuery } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const qRaw = searchParams.get("q")?.trim() ?? "";
    const q = normalizeSearchQuery(qRaw);
    const state = searchParams.get("state") ?? undefined;
    const hasAC = searchParams.get("hasAC") === "true";
    const freshmanOnly = searchParams.get("freshmanOnly") === "true";
    const honorsHousing = searchParams.get("honorsHousing") === "true";
    const minCost = searchParams.get("minCost") ? Number(searchParams.get("minCost")) : undefined;
    const maxCost = searchParams.get("maxCost") ? Number(searchParams.get("maxCost")) : undefined;
    const minScore = searchParams.get("minScore") ? Number(searchParams.get("minScore")) : undefined;
    const bathroomStyle = searchParams.get("bathroomStyle") ?? undefined;
    const dormType = searchParams.get("dormType") ?? undefined;
    const { page, pageSize, skip } = parsePagination(searchParams, { pageSize: 60 });

    const where: Prisma.DormWhereInput = {
      isActive: true,
      AND: [
        q
          ? {
              OR: [
                { name: { contains: qRaw, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
                { college: { name: { contains: qRaw, mode: "insensitive" } } },
                { college: { aliases: { some: { alias: { contains: qRaw, mode: "insensitive" } } } } },
                { aliases: { some: { alias: { contains: qRaw, mode: "insensitive" } } } },
              ],
            }
          : {},
        state ? { college: { state } } : {},
        hasAC ? { hasAC: true } : {},
        freshmanOnly ? { freshmanEligible: true } : {},
        honorsHousing ? { honorsHousing: true } : {},
        minCost != null && !Number.isNaN(minCost) ? { yearlyCost: { gte: minCost } } : {},
        maxCost != null && !Number.isNaN(maxCost) ? { yearlyCost: { lte: maxCost } } : {},
        bathroomStyle ? { bathroomStyle: bathroomStyle as never } : {},
        dormType ? { dormType: dormType as never } : {},
        minScore != null && !Number.isNaN(minScore)
          ? { dormScore: { overallScore: { gte: minScore } } }
          : {},
      ],
    };

    const [total, dorms] = await Promise.all([
      prisma.dorm.count({ where }),
      prisma.dorm.findMany({
        where,
        include: {
          college: { select: { name: true, slug: true, state: true, city: true } },
          dormScore: true,
          dormAmenities: { include: { amenity: true } },
          reviewSummaries: { take: 1 },
        },
        skip,
        take: pageSize,
        orderBy: { dormScore: { overallScore: "desc" } },
      }),
    ]);

    // Dual shape: paginated object + items array for newer clients;
    // also return items at top-level when Accept wants array — UI uses Array.isArray fallback.
    return jsonOk({
      items: dorms,
      dorms,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 0,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
