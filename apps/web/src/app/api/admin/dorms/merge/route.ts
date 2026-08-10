import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError, handleRouteError, requireAdminAuth } from "@/lib/api";
import { writeAdminAudit } from "@/lib/admin-data";
import { auth, currentUser } from "@clerk/nextjs/server";
import { DataQualityStatus } from "@dormscope/database";

export const dynamic = "force-dynamic";

const schema = z.object({
  keepId: z.string().min(1),
  mergeId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const ok = await requireAdminAuth(req);
    if (!ok) return jsonError("Unauthorized", 401);

    const body = schema.parse(await req.json());
    if (body.keepId === body.mergeId) return jsonError("keepId and mergeId must differ", 400);

    const [keep, merge] = await Promise.all([
      prisma.dorm.findUnique({ where: { id: body.keepId }, select: { id: true, name: true, collegeId: true } }),
      prisma.dorm.findUnique({ where: { id: body.mergeId }, select: { id: true, name: true, collegeId: true } }),
    ]);
    if (!keep) return jsonError("keepId not found", 404);
    if (!merge) return jsonError("mergeId not found", 404);
    if (keep.collegeId !== merge.collegeId) return jsonError("Dorms must belong to the same college", 400);

    // Re-parent children and reviews of the merged dorm to the kept dorm
    await prisma.$transaction([
      prisma.dorm.updateMany({ where: { parentHousingId: body.mergeId }, data: { parentHousingId: body.keepId } }),
      prisma.review.updateMany({ where: { dormId: body.mergeId }, data: { dormId: body.keepId } }),
      prisma.dormSource.updateMany({ where: { dormId: body.mergeId }, data: { dormId: body.keepId } }),
      prisma.dataCorrection.updateMany({ where: { dormId: body.mergeId }, data: { dormId: body.keepId } }),
      prisma.dorm.update({
        where: { id: body.mergeId },
        data: {
          dataQualityStatus: DataQualityStatus.DUPLICATE,
          duplicateOfId: body.keepId,
          isActive: false,
        },
      }),
    ]);

    const { userId } = await auth();
    const user = userId ? await currentUser() : null;
    const actorEmail = user?.emailAddresses?.[0]?.emailAddress ?? null;

    await writeAdminAudit({
      actorId: userId,
      actorEmail,
      action: "merge_dorm",
      entityType: "Dorm",
      entityId: body.keepId,
      before: { mergeId: body.mergeId, mergeName: merge.name },
      after: { keepId: body.keepId, keepName: keep.name },
      note: `Merged "${merge.name}" into "${keep.name}"`,
    });

    return jsonOk({ kept: keep, merged: merge });
  } catch (err) {
    return handleRouteError(err);
  }
}
