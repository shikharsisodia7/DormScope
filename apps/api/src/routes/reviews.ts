import { createHash } from "crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "@dormscope/database";
import { asyncHandler } from "../middleware/errorHandler.js";

export const reviewsRouter = Router();

const buckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}

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

reviewsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const ip = req.ip || "unknown";
    if (!rateLimit(`review:${ip}`, 8, 60 * 60 * 1000)) {
      return res.status(429).json({ error: "Too many review submissions" });
    }
    const input = reviewSchema.parse(req.body);
    const dorm = await prisma.dorm.findUnique({ where: { id: input.dormId }, select: { id: true } });
    if (!dorm) return res.status(404).json({ error: "Dorm not found" });

    const review = await prisma.review.create({
      data: {
        ...input,
        categoryRatings: input.categoryRatings ?? undefined,
        status: "PENDING",
        ipHash: createHash("sha256").update(ip).digest("hex").slice(0, 32),
      },
      select: { id: true, status: true, createdAt: true },
    });
    res.status(201).json({ review, message: "Review submitted for moderation" });
  })
);
