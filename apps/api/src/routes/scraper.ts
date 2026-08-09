import { Router } from "express";
import { prisma } from "@dormscope/database";
import { requireAdminKey } from "../middleware/adminAuth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { assertSafeUrl } from "../security/ssrf.js";

export const scraperRouter = Router();

scraperRouter.get(
  "/jobs",
  asyncHandler(async (_req, res) => {
    const jobs = await prisma.scrapeJob.findMany({
      include: {
        college: { select: { name: true, slug: true } },
        logs: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    res.json(jobs);
  })
);

scraperRouter.post(
  "/run/:collegeSlug",
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const college = await prisma.college.findUnique({ where: { slug: req.params.collegeSlug } });
    if (!college) return res.status(404).json({ error: "College not found" });

    // SSRF gate on any configured housing URL before scraper navigates
    if (college.housingUrl) {
      await assertSafeUrl(college.housingUrl);
    }

    try {
      const { runScraperForCollege } = await import("@dormscope/scraper");
      const result = await runScraperForCollege(req.params.collegeSlug);
      return res.json(result);
    } catch {
      const job = await prisma.scrapeJob.create({
        data: {
          collegeId: college.id,
          status: "PENDING",
          candidateUrls: college.housingUrl ? [college.housingUrl] : [],
        },
      });
      return res.json({
        message: "Job queued (run scraper CLI for full scrape)",
        jobId: job.id,
      });
    }
  })
);

scraperRouter.patch(
  "/sources/:id/approve",
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const source = await prisma.source.update({
      where: { id: req.params.id },
      data: { isApproved: true },
    });
    res.json(source);
  })
);

scraperRouter.patch(
  "/dorms/:id/verify",
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const dorm = await prisma.dorm.update({
      where: { id: req.params.id },
      data: { isVerified: true, verifiedAt: new Date(), confidenceScore: 0.95 },
    });
    res.json(dorm);
  })
);
