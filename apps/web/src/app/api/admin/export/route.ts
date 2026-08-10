import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError, handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    if (!(await requireAdminAuth(req))) return jsonError("Unauthorized", 401);

    const data = await prisma.dorm.findMany({
      include: {
        college: { select: { name: true, slug: true, state: true, city: true } },
        dormScore: true,
        dormAmenities: { include: { amenity: true } },
        sources: { where: { isApproved: true }, take: 5 },
      },
      take: 5000,
    });

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": "attachment; filename=dormscope-export.json",
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
