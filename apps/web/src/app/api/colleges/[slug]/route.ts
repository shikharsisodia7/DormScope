import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api";
import { buildCollegeHighlights } from "@/lib/college-helpers";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  try {
    const college = await prisma.college.findUnique({
      where: { slug: params.slug },
      include: {
        dorms: {
          where: { isActive: true },
          include: {
            dormScore: true,
            dormAmenities: { include: { amenity: true } },
            reviewSummaries: { take: 1 },
          },
          orderBy: { name: "asc" },
        },
        sources: { where: { isApproved: true }, take: 10 },
        aliases: { select: { alias: true } },
        campuses: true,
      },
    });

    if (!college) return jsonError("College not found", 404);

    const highlights = buildCollegeHighlights(college.dorms);

    return jsonOk({
      ...college,
      dormCount: college.dorms.length,
      highlights,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
