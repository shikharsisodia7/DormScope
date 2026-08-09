import { Prisma } from "@dormscope/database";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError, handleRouteError, parsePagination } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  try {
    const college = await prisma.college.findUnique({ where: { slug: params.slug } });
    if (!college) return jsonError("College not found", 404);

    const { searchParams } = new URL(req.url);
    const { page, pageSize, skip } = parsePagination(searchParams, { pageSize: 50 });
    const hasAC = searchParams.get("hasAC") === "true";
    const freshmanOnly = searchParams.get("freshmanOnly") === "true";
    const bathroomStyle = searchParams.get("bathroomStyle") ?? undefined;
    const dormType = searchParams.get("dormType") ?? undefined;
    const q = searchParams.get("q")?.trim();

    const where: Prisma.DormWhereInput = {
      collegeId: college.id,
      isActive: true,
      AND: [
        q ? { name: { contains: q, mode: "insensitive" } } : {},
        hasAC ? { hasAC: true } : {},
        freshmanOnly ? { freshmanEligible: true } : {},
        bathroomStyle ? { bathroomStyle: bathroomStyle as never } : {},
        dormType ? { dormType: dormType as never } : {},
      ],
    };

    const [total, dorms] = await Promise.all([
      prisma.dorm.count({ where }),
      prisma.dorm.findMany({
        where,
        include: {
          dormScore: true,
          dormAmenities: { include: { amenity: true } },
          reviewSummaries: { take: 1 },
        },
        orderBy: [{ dormScore: { overallScore: "desc" } }, { name: "asc" }],
        skip,
        take: pageSize,
      }),
    ]);

    return jsonOk({ items: dorms, dorms, total, page, pageSize, collegeSlug: college.slug });
  } catch (err) {
    return handleRouteError(err);
  }
}
