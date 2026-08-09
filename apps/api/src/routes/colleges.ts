import { Router } from "express";
import { prisma, Prisma } from "@dormscope/database";
import { asyncHandler } from "../middleware/errorHandler.js";

export const collegesRouter = Router();

function buildHighlights<T extends {
  yearlyCost?: number | null;
  freshmanEligible?: boolean | null;
  socialVibe?: number | null;
  quietVibe?: number | null;
  dormScore?: { freshmanFitScore?: number | null; valueScore?: number | null } | null;
}>(dorms: T[]) {
  const withCost = dorms.filter((d) => d.yearlyCost != null);
  const costs = withCost.map((d) => d.yearlyCost!) as number[];
  const avgCost = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;

  return {
    avgCost,
    cheapest: [...withCost].sort((a, b) => (a.yearlyCost ?? 0) - (b.yearlyCost ?? 0))[0],
    expensive: [...withCost].sort((a, b) => (b.yearlyCost ?? 0) - (a.yearlyCost ?? 0))[0],
    bestFreshman: [...dorms.filter((d) => d.freshmanEligible)].sort(
      (a, b) => (b.dormScore?.freshmanFitScore ?? 0) - (a.dormScore?.freshmanFitScore ?? 0)
    )[0],
    bestValue: [...dorms].sort(
      (a, b) => (b.dormScore?.valueScore ?? 0) - (a.dormScore?.valueScore ?? 0)
    )[0],
    mostSocial: [...dorms].sort((a, b) => (b.socialVibe ?? 0) - (a.socialVibe ?? 0))[0],
    quietest: [...dorms].sort((a, b) => (b.quietVibe ?? 0) - (a.quietVibe ?? 0))[0],
  };
}

collegesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = (req.query.q as string)?.trim();
    const state = req.query.state as string | undefined;
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 24) || 24));
    const skip = (page - 1) * pageSize;

    const where: Prisma.CollegeWhereInput = {
      AND: [
        state ? { state } : {},
        q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { officialName: { contains: q, mode: "insensitive" } },
                { shortName: { contains: q, mode: "insensitive" } },
                { city: { contains: q, mode: "insensitive" } },
                { aliases: { some: { alias: { contains: q, mode: "insensitive" } } } },
              ],
            }
          : {},
      ],
    };

    const [total, colleges] = await Promise.all([
      prisma.college.count({ where }),
      prisma.college.findMany({
        where,
        include: { _count: { select: { dorms: true } }, aliases: { take: 5 } },
        orderBy: { name: "asc" },
        skip,
        take: pageSize,
      }),
    ]);

    const items = colleges.map((c) => ({
      ...c,
      dormCount: c._count.dorms,
      hasResidentialHousing: c.hasResidentialHousing,
      housingCoverageStatus: c.housingCoverageStatus,
    }));

    res.json({ items, colleges: items, total, page, pageSize });
  })
);

collegesRouter.get(
  "/map",
  asyncHandler(async (req, res) => {
    const limit = Math.min(5000, Math.max(1, Number(req.query.limit ?? 2000) || 2000));
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
      },
      take: limit,
    });

    const costAgg = await prisma.dorm.groupBy({
      by: ["collegeId"],
      where: { collegeId: { in: colleges.map((c) => c.id) }, yearlyCost: { not: null } },
      _avg: { yearlyCost: true },
    });
    const avgByCollege = new Map(costAgg.map((r) => [r.collegeId, r._avg.yearlyCost]));

    res.json(
      colleges.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        city: c.city,
        state: c.state,
        lat: c.latitude,
        lng: c.longitude,
        dormCount: c._count.dorms,
        avgCost: avgByCollege.get(c.id) ?? null,
      }))
    );
  })
);

collegesRouter.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const college = await prisma.college.findUnique({
      where: { slug: req.params.slug },
      include: {
        dorms: {
          where: { isActive: true },
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

    res.json({ ...college, highlights: buildHighlights(college.dorms) });
  })
);

collegesRouter.get(
  "/:slug/dorms",
  asyncHandler(async (req, res) => {
    const college = await prisma.college.findUnique({ where: { slug: req.params.slug } });
    if (!college) return res.status(404).json({ error: "College not found" });

    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 50) || 50));
    const where: Prisma.DormWhereInput = { collegeId: college.id, isActive: true };

    const [total, dorms] = await Promise.all([
      prisma.dorm.count({ where }),
      prisma.dorm.findMany({
        where,
        include: {
          dormScore: true,
          dormAmenities: { include: { amenity: true } },
          reviewSummaries: { take: 1 },
        },
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    res.json({ items: dorms, dorms, total, page, pageSize });
  })
);
