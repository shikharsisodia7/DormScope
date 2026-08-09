import { prisma } from "@/lib/prisma";
import { jsonOk, handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return jsonOk({ ok: true, service: "dormscope-web", db: "up" });
  } catch (err) {
    return handleRouteError(err);
  }
}
