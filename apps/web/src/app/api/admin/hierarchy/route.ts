import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError, handleRouteError, requireAdminAuth } from "@/lib/api";
import { writeAdminAudit } from "@/lib/admin-data";
import { auth, currentUser } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

const schema = z.object({
  childId: z.string().min(1),
  parentId: z.string().nullable(),
});

export async function POST(req: Request) {
  try {
    const ok = await requireAdminAuth(req);
    if (!ok) return jsonError("Unauthorized", 401);

    const body = schema.parse(await req.json());
    if (body.parentId && body.parentId === body.childId) {
      return jsonError("childId and parentId must differ", 400);
    }

    const child = await prisma.dorm.findUnique({
      where: { id: body.childId },
      select: { id: true, name: true, parentHousingId: true, collegeId: true },
    });
    if (!child) return jsonError("childId not found", 404);

    if (body.parentId) {
      const parent = await prisma.dorm.findUnique({
        where: { id: body.parentId },
        select: { id: true, collegeId: true },
      });
      if (!parent) return jsonError("parentId not found", 404);
      if (parent.collegeId !== child.collegeId) {
        return jsonError("Parent and child must belong to the same college", 400);
      }
    }

    const after = await prisma.dorm.update({
      where: { id: body.childId },
      data: { parentHousingId: body.parentId },
      select: { id: true, name: true, parentHousingId: true },
    });

    const { userId } = await auth();
    const user = userId ? await currentUser() : null;
    const actorEmail = user?.emailAddresses?.[0]?.emailAddress ?? null;

    await writeAdminAudit({
      actorId: userId,
      actorEmail,
      action: "set_parent",
      entityType: "Dorm",
      entityId: body.childId,
      before: { parentHousingId: child.parentHousingId },
      after: { parentHousingId: body.parentId },
      note: `Set parent of "${child.name}" to ${body.parentId ?? "none"}`,
    });

    return jsonOk({ dorm: after });
  } catch (err) {
    return handleRouteError(err);
  }
}
