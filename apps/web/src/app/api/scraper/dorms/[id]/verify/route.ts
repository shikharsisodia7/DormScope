import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError, handleRouteError, requireAdminKey } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    if (!requireAdminKey(req)) return jsonError("Unauthorized", 401);
    const dorm = await prisma.dorm.update({
      where: { id: params.id },
      data: { isVerified: true, verifiedAt: new Date(), confidenceScore: 0.95 },
    });
    return jsonOk(dorm);
  } catch (err) {
    return handleRouteError(err);
  }
}
