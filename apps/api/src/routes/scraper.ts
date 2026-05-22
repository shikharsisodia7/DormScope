import { Router } from "express";
import { prisma } from "@dormscope/database";

export const scraperRouter = Router();

scraperRouter.get("/jobs", async (_req, res) => {
  try {
    const jobs = await prisma.scrapeJob.findMany({
      include: {
        college: { select: { name: true, slug: true } },
        logs: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    res.json(jobs);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

scraperRouter.post("/run/:collegeSlug", async (req, res) => {
  try {
    const { runScraperForCollege } = await import("@dormscope/scraper/src/jobs/runScraper.js").catch(() => ({
      runScraperForCollege: null,
    }));

    if (!runScraperForCollege) {
      const college = await prisma.college.findUnique({ where: { slug: req.params.collegeSlug } });
      if (!college) return res.status(404).json({ error: "College not found" });
      const job = await prisma.scrapeJob.create({
        data: { collegeId: college.id, status: "PENDING", candidateUrls: [college.housingUrl ?? ""] },
      });
      return res.json({ message: "Job queued (run scraper CLI for full scrape)", jobId: job.id });
    }

    const result = await runScraperForCollege(req.params.collegeSlug);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

scraperRouter.patch("/sources/:id/approve", async (req, res) => {
  try {
    const source = await prisma.source.update({
      where: { id: req.params.id },
      data: { isApproved: true },
    });
    res.json(source);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

scraperRouter.patch("/dorms/:id/verify", async (req, res) => {
  try {
    const dorm = await prisma.dorm.update({
      where: { id: req.params.id },
      data: { isVerified: true, verifiedAt: new Date(), confidenceScore: 0.95 },
    });
    res.json(dorm);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});
