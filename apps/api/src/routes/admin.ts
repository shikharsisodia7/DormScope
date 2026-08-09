import { Router } from "express";
import { z } from "zod";
import { prisma } from "@dormscope/database";
import { fuzzyDormNameMatch } from "@dormscope/shared";
import { requireAdminKey } from "../middleware/adminAuth.js";
import { asyncHandler } from "../middleware/errorHandler.js";

export const adminRouter = Router();

adminRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const expected = process.env.ADMIN_API_KEY;
    if (!expected) return res.status(503).json({ error: "Admin auth not configured" });
    const body = z.object({ apiKey: z.string().optional() }).safeParse(req.body ?? {});
    const header =
      (req.headers["x-admin-key"] as string | undefined) ??
      (typeof req.headers.authorization === "string"
        ? req.headers.authorization.replace(/^Bearer\s+/i, "")
        : undefined);
    const key = header || body.data?.apiKey;
    if (!key || key !== expected) return res.status(401).json({ error: "Invalid admin key" });
    res.json({ ok: true, message: "Admin key accepted. Send x-admin-key on mutating admin routes." });
  })
);

adminRouter.get(
  "/overview",
  asyncHandler(async (req, res) => {
    if (process.env.ADMIN_API_KEY) {
      // soft-require when configured
      const header = req.headers["x-admin-key"];
      if (header !== process.env.ADMIN_API_KEY) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    const [
      colleges,
      dorms,
      sources,
      jobs,
      avgConf,
      missingCost,
      missingAmenities,
      failedJobs,
      stale,
    ] = await Promise.all([
      prisma.college.count(),
      prisma.dorm.count(),
      prisma.source.count(),
      prisma.scrapeJob.count(),
      prisma.dorm.aggregate({ _avg: { confidenceScore: true, dataCompletenessScore: true } }),
      prisma.dorm.count({ where: { yearlyCost: null } }),
      prisma.dorm.count({ where: { dormAmenities: { none: {} } } }),
      prisma.scrapeJob.count({ where: { status: "FAILED" } }),
      prisma.dorm.count({
        where: { lastUpdatedAt: { lt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) } },
      }),
    ]);

    const successJobs = await prisma.scrapeJob.count({ where: { status: "COMPLETED" } });
    const scrapeSuccessRate = jobs ? Math.round((successJobs / jobs) * 100) : 0;

    const allDorms = await prisma.dorm.findMany({
      select: { id: true, name: true, collegeId: true },
      take: 500,
    });
    const duplicateWarnings: { a: string; b: string; score: number }[] = [];
    for (let i = 0; i < allDorms.length; i++) {
      for (let j = i + 1; j < allDorms.length; j++) {
        if (allDorms[i].collegeId !== allDorms[j].collegeId) continue;
        const score = fuzzyDormNameMatch(allDorms[i].name, allDorms[j].name);
        if (score >= 0.85 && score < 1) {
          duplicateWarnings.push({ a: allDorms[i].name, b: allDorms[j].name, score });
          if (duplicateWarnings.length >= 20) break;
        }
      }
      if (duplicateWarnings.length >= 20) break;
    }

    res.json({
      colleges,
      dorms,
      sources,
      scrapeSuccessRate,
      avgConfidence: Math.round((avgConf._avg.confidenceScore ?? 0) * 100),
      avgCompleteness: Math.round((avgConf._avg.dataCompletenessScore ?? 0) * 100),
      missingCost,
      missingAmenities,
      duplicateWarnings,
      staleRecords: stale,
      failedJobs,
    });
  })
);

adminRouter.get(
  "/export",
  requireAdminKey,
  asyncHandler(async (_req, res) => {
    const data = await prisma.dorm.findMany({
      include: {
        college: { select: { name: true, slug: true, state: true } },
        dormScore: true,
        dormAmenities: { include: { amenity: true } },
      },
      take: 5000,
    });
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=dormscope-export.json");
    res.json(data);
  })
);

adminRouter.get(
  "/coverage",
  requireAdminKey,
  asyncHandler(async (_req, res) => {
    const [colleges, dorms, withHousingUrl, byStatus, verifiedDorms] = await Promise.all([
      prisma.college.count(),
      prisma.dorm.count(),
      prisma.college.count({ where: { housingUrl: { not: null } } }),
      prisma.college.groupBy({ by: ["housingCoverageStatus"], _count: true }),
      prisma.dorm.count({ where: { isVerified: true } }),
    ]);
    res.json({
      colleges,
      dorms,
      withHousingUrl,
      verifiedDorms,
      housingCoverageStatus: Object.fromEntries(
        byStatus.map((r) => [r.housingCoverageStatus, r._count])
      ),
    });
  })
);

adminRouter.patch(
  "/reviews/:id",
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const status = z.enum(["APPROVED", "REJECTED", "HIDDEN", "PENDING"]).parse(req.body.status);
    const review = await prisma.review.update({
      where: { id: req.params.id },
      data: { status, moderatedAt: new Date() },
      select: { id: true, status: true, moderatedAt: true },
    });
    res.json({ review });
  })
);
