import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError, handleRouteError, rateLimit } from "@/lib/api";

export const dynamic = "force-dynamic";

const correctionSchema = z.object({
  dormId: z.string().min(1),
  fieldName: z.string().min(1).max(80),
  proposedValue: z.string().min(1).max(2000),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  submitterNote: z.string().max(1000).optional(),
});

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    if (!rateLimit(`correction:${ip}`, 20, 60 * 60 * 1000)) {
      return jsonError("Too many correction submissions. Try again later.", 429);
    }

    const input = correctionSchema.parse(await req.json());
    const dorm = await prisma.dorm.findUnique({ where: { id: input.dormId }, select: { id: true } });
    if (!dorm) return jsonError("Dorm not found", 404);

    const correction = await prisma.dataCorrection.create({
      data: {
        dormId: input.dormId,
        fieldName: input.fieldName,
        proposedValue: input.proposedValue,
        sourceUrl: input.sourceUrl || null,
        submitterNote: input.submitterNote,
        status: "PENDING",
      },
      select: { id: true, status: true, createdAt: true },
    });

    return jsonOk({ correction, message: "Correction submitted for review" }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
