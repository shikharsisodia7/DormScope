import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError, handleRouteError, requireAdminAuth } from "@/lib/api";
import { writeAdminAudit } from "@/lib/admin-data";
import { auth, currentUser } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

const schema = z.object({ assignable: z.boolean() });

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ok = await requireAdminAuth(req);
    if (!ok) return jsonError("Unauthorized", 401);

    const body = schema.parse(await req.json());

    const before = await prisma.dorm.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, isAssignableHousingOption: true },
    });
    if (!before) return jsonError("Dorm not found", 404);

    const after = await prisma.dorm.update({
      where: { id: params.id },
      data: { isAssignableHousingOption: body.assignable },
      select: { id: true, name: true, isAssignableHousingOption: true },
    });

    const { userId } = await auth();
    const user = userId ? await currentUser() : null;
    const actorEmail = user?.emailAddresses?.[0]?.emailAddress ?? null;

    await writeAdminAudit({
      actorId: userId,
      actorEmail,
      action: "set_assignability",
      entityType: "Dorm",
      entityId: params.id,
      before,
      after,
      note: `assignable → ${body.assignable}`,
    });

    return jsonOk({ dorm: after });
  } catch (err) {
    return handleRouteError(err);
  }
}
