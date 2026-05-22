import { Router } from "express";
import { prisma, Prisma } from "@dormscope/database";

export const dormsRouter = Router();

dormsRouter.get("/search", async (req, res) => {
  try {
    const q = (req.query.q as string)?.trim();
    const state = req.query.state as string | undefined;
    const hasAC = req.query.hasAC === "true";
    const freshmanOnly = req.query.freshmanOnly === "true";
    const honorsHousing = req.query.honorsHousing === "true";
    const minCost = req.query.minCost ? Number(req.query.minCost) : undefined;
    const maxCost = req.query.maxCost ? Number(req.query.maxCost) : undefined;
    const minScore = req.query.minScore ? Number(req.query.minScore) : undefined;
    const bathroomStyle = req.query.bathroomStyle as string | undefined;
    const dormType = req.query.dormType as string | undefined;

    const where: Prisma.DormWhereInput = {
      AND: [
        q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { college: { name: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {},
        state ? { college: { state } } : {},
        hasAC ? { hasAC: true } : {},
        freshmanOnly ? { freshmanEligible: true } : {},
        honorsHousing ? { honorsHousing: true } : {},
        minCost ? { yearlyCost: { gte: minCost } } : {},
        maxCost ? { yearlyCost: { lte: maxCost } } : {},
        bathroomStyle ? { bathroomStyle: bathroomStyle as never } : {},
        dormType ? { dormType: dormType as never } : {},
        minScore ? { dormScore: { overallScore: { gte: minScore } } } : {},
      ],
    };

    const dorms = await prisma.dorm.findMany({
      where,
      include: {
        college: { select: { name: true, slug: true, state: true, city: true } },
        dormScore: true,
        dormAmenities: { include: { amenity: true } },
        reviewSummaries: { take: 1 },
      },
      take: 60,
      orderBy: { dormScore: { overallScore: "desc" } },
    });

    res.json(dorms);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

dormsRouter.get("/:collegeSlug/:dormSlug", async (req, res) => {
  try {
    const college = await prisma.college.findUnique({ where: { slug: req.params.collegeSlug } });
    if (!college) return res.status(404).json({ error: "College not found" });

    const dorm = await prisma.dorm.findUnique({
      where: { collegeId_slug: { collegeId: college.id, slug: req.params.dormSlug } },
      include: {
        college: true,
        dormScore: true,
        roomTypes: true,
        dormAmenities: { include: { amenity: true } },
        housingCosts: true,
        sources: true,
        reviewSummaries: true,
      },
    });

    if (!dorm) return res.status(404).json({ error: "Dorm not found" });

    const collegeCosts = await prisma.dorm.findMany({
      where: { collegeId: college.id },
      select: { yearlyCost: true },
    });
    const avg =
      collegeCosts.filter((c) => c.yearlyCost).reduce((s, c) => s + (c.yearlyCost ?? 0), 0) /
      (collegeCosts.filter((c) => c.yearlyCost).length || 1);

    res.json({ dorm, collegeAvgCost: avg });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

dormsRouter.post("/compare", async (req, res) => {
  try {
    const ids: string[] = req.body.ids ?? [];
    if (!ids.length) return res.status(400).json({ error: "ids required" });

    const dorms = await prisma.dorm.findMany({
      where: { id: { in: ids.slice(0, 4) } },
      include: { college: true, dormScore: true, dormAmenities: { include: { amenity: true } } },
    });

    res.json(dorms);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});
