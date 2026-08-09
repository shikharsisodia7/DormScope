import { z } from "zod";
import { compareRecommendation } from "@dormscope/scoring";
import { prisma } from "@/lib/prisma";
import { jsonOk, handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z.object({
  ids: z.array(z.string()).min(1).max(4),
});

export async function POST(req: Request) {
  try {
    const { ids } = schema.parse(await req.json());
    const dorms = await prisma.dorm.findMany({
      where: { id: { in: ids } },
      include: { college: true, dormScore: true },
    });
    const summary = compareRecommendation(
      dorms.map((d) => ({
        id: d.id,
        name: d.name,
        collegeName: d.college.name,
        yearlyCost: d.yearlyCost,
        socialVibe: d.socialVibe,
        dormScore: d.dormScore,
      }))
    );
    return jsonOk({ summary });
  } catch (err) {
    return handleRouteError(err);
  }
}
