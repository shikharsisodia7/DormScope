import { Router } from "express";
import { prisma } from "@dormscope/database";

export const collegesRouter = Router();

collegesRouter.get("/", async (req, res) => {
  try {
    const q = (req.query.q as string)?.trim();
    const state = req.query.state as string | undefined;

    const colleges = await prisma.college.findMany({
      where: {
        AND: [
          q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }] } : {},
          state ? { state } : {},
        ],
      },
      include: { _count: { select: { dorms: true } } },
      orderBy: { name: "asc" },
      take: 50,
    });

    res.json(colleges);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

collegesRouter.get("/map", async (_req, res) => {
  try {
    const colleges = await prisma.college.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        state: true,
        latitude: true,
        longitude: true,
        schoolType: true,
        _count: { select: { dorms: true } },
        dorms: { select: { yearlyCost: true } },
      },
    });

    const pins = colleges.map((c) => {
      const costs = c.dorms.map((d) => d.yearlyCost).filter(Boolean) as number[];
      const avgCost = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : null;
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        city: c.city,
        state: c.state,
        lat: c.latitude,
        lng: c.longitude,
        dormCount: c._count.dorms,
        avgCost,
      };
    });

    res.json(pins);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

collegesRouter.get("/:slug", async (req, res) => {
  try {
    const college = await prisma.college.findUnique({
      where: { slug: req.params.slug },
      include: {
        dorms: {
          include: {
            dormScore: true,
            dormAmenities: { include: { amenity: true } },
            reviewSummaries: { take: 1 },
          },
          orderBy: { name: "asc" },
        },
        sources: { where: { isApproved: true }, take: 10 },
      },
    });

    if (!college) return res.status(404).json({ error: "College not found" });

    const costs = college.dorms.map((d) => d.yearlyCost).filter(Boolean) as number[];
    const avgCost = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;

    const highlights = {
      avgCost,
      cheapest: college.dorms.filter((d) => d.yearlyCost).sort((a, b) => (a.yearlyCost ?? 0) - (b.yearlyCost ?? 0))[0],
      expensive: college.dorms.filter((d) => d.yearlyCost).sort((a, b) => (b.yearlyCost ?? 0) - (a.yearlyCost ?? 0))[0],
      bestFreshman: college.dorms.filter((d) => d.freshmanEligible).sort((a, b) => (b.dormScore?.freshmanFitScore ?? 0) - (a.dormScore?.freshmanFitScore ?? 0))[0],
      bestValue: college.dorms.sort((a, b) => (b.dormScore?.valueScore ?? 0) - (a.dormScore?.valueScore ?? 0))[0],
      mostSocial: college.dorms.sort((a, b) => (b.socialVibe ?? 0) - (a.socialVibe ?? 0))[0],
      quietest: college.dorms.sort((a, b) => (b.quietVibe ?? 0) - (a.quietVibe ?? 0))[0],
    };

    res.json({ ...college, highlights });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});
