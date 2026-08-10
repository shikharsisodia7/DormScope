import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    if (!(await requireAdminAuth(req))) return jsonError("Unauthorized", 401);
    const source = await prisma.source.update({
      where: { id: params.id },
      data: { isApproved: true },
    });
    return jsonOk(source);
  } catch (err) {
    return handleRouteError(err);
  }
}
