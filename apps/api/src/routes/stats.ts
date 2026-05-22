import { Router } from "express";
import { prisma } from "@dormscope/database";

export const statsRouter = Router();

statsRouter.get("/", async (_req, res) => {
  try {
    const [colleges, dorms, sources, confidence, states] = await Promise.all([
      prisma.college.count(),
      prisma.dorm.count(),
      prisma.source.count(),
      prisma.dorm.aggregate({ _avg: { confidenceScore: true } }),
      prisma.college.findMany({ select: { state: true }, distinct: ["state"] }),
    ]);

    res.json({
      totalColleges: colleges,
      totalDorms: dorms,
      totalSources: sources,
      avgConfidence: Math.round((confidence._avg.confidenceScore ?? 0.5) * 100),
      statesCovered: states.length,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});
