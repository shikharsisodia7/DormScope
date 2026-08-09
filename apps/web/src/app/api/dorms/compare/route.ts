import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(4),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const dorms = await prisma.dorm.findMany({
      where: { id: { in: body.ids.slice(0, 4) } },
      include: {
        college: true,
        dormScore: true,
        dormAmenities: { include: { amenity: true } },
        roomTypes: true,
      },
    });
    return jsonOk(dorms);
  } catch (err) {
    if (err instanceof z.ZodError) return jsonError("ids required (max 4)", 400, err.flatten());
    return handleRouteError(err);
  }
}
