import { createHash } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError, handleRouteError, rateLimit } from "@/lib/api";

export const dynamic = "force-dynamic";

const reviewSchema = z.object({
  dormId: z.string().min(1),
  overallRating: z.number().min(1).max(5),
  categoryRatings: z.record(z.number()).optional(),
  schoolYear: z.string().max(40).optional(),
  classYearLived: z.string().max(40).optional(),
  roomTypeLived: z.string().max(80).optional(),
  pros: z.string().max(2000).optional(),
  cons: z.string().max(2000).optional(),
  advice: z.string().max(2000).optional(),
  body: z.string().max(5000).optional(),
  sessionId: z.string().max(128).optional(),
});

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    if (!rateLimit(`review:${ip}`, 8, 60 * 60 * 1000)) {
      return jsonError("Too many review submissions. Try again later.", 429);
    }

    const input = reviewSchema.parse(await req.json());
    const dorm = await prisma.dorm.findUnique({ where: { id: input.dormId }, select: { id: true } });
    if (!dorm) return jsonError("Dorm not found", 404);

    const review = await prisma.review.create({
      data: {
        dormId: input.dormId,
        overallRating: input.overallRating,
        categoryRatings: input.categoryRatings ?? undefined,
        schoolYear: input.schoolYear,
        classYearLived: input.classYearLived,
        roomTypeLived: input.roomTypeLived,
        pros: input.pros,
        cons: input.cons,
        advice: input.advice,
        body: input.body,
        sessionId: input.sessionId,
        status: "PENDING",
        ipHash: createHash("sha256").update(ip).digest("hex").slice(0, 32),
      },
      select: { id: true, status: true, createdAt: true },
    });

    return jsonOk({ review, message: "Review submitted for moderation" }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
