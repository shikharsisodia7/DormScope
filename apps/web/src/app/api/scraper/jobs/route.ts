import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError, handleRouteError, requireAdminKey } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    if (process.env.ADMIN_API_KEY && !requireAdminKey(req)) {
      return jsonError("Unauthorized", 401);
    }

    const jobs = await prisma.scrapeJob.findMany({
      include: {
        college: { select: { name: true, slug: true } },
        logs: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return jsonOk(jobs);
  } catch (err) {
    return handleRouteError(err);
  }
}
