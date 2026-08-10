import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError, handleRouteError, requireAdminAuth } from "@/lib/api";
import { writeAdminAudit } from "@/lib/admin-data";
import { auth, currentUser } from "@clerk/nextjs/server";
import { DataQualityStatus } from "@dormscope/database";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ok = await requireAdminAuth(req);
    if (!ok) return jsonError("Unauthorized", 401);

    const before = await prisma.dorm.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, dataQualityStatus: true, quarantineReason: true },
    });
    if (!before) return jsonError("Dorm not found", 404);

    const after = await prisma.dorm.update({
      where: { id: params.id },
      data: {
        dataQualityStatus: DataQualityStatus.ACTIVE,
        quarantineReason: null,
        quarantinedAt: null,
        quarantinedBy: null,
      },
      select: { id: true, name: true, dataQualityStatus: true, quarantineReason: true },
    });

    const { userId } = await auth();
    const user = userId ? await currentUser() : null;
    const actorEmail = user?.emailAddresses?.[0]?.emailAddress ?? null;

    await writeAdminAudit({
      actorId: userId,
      actorEmail,
      action: "restore",
      entityType: "Dorm",
      entityId: params.id,
      before,
      after,
    });

    return jsonOk({ dorm: after });
  } catch (err) {
    return handleRouteError(err);
  }
}
