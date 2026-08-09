import { Router } from "express";
import { z } from "zod";
import { prisma, Prisma } from "@dormscope/database";
import { asyncHandler } from "../middleware/errorHandler.js";

export const dormsRouter = Router();

dormsRouter.get(
  "/search",
  asyncHandler(async (req, res) => {
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
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 60) || 60));

    const where: Prisma.DormWhereInput = {
      isActive: true,
      AND: [
        q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { college: { name: { contains: q, mode: "insensitive" } } },
                { college: { aliases: { some: { alias: { contains: q, mode: "insensitive" } } } } },
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

    const [total, dorms] = await Promise.all([
      prisma.dorm.count({ where }),
      prisma.dorm.findMany({
        where,
        include: {
          college: { select: { name: true, slug: true, state: true, city: true } },
          dormScore: true,
          dormAmenities: { include: { amenity: true } },
          reviewSummaries: { take: 1 },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { dormScore: { overallScore: "desc" } },
      }),
    ]);

    res.json({ items: dorms, dorms, total, page, pageSize });
  })
);

dormsRouter.get(
  "/:collegeSlug/:dormSlug",
  asyncHandler(async (req, res) => {
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
        sources: { where: { isApproved: true } },
        reviewSummaries: true,
        reviews: {
          where: { status: "APPROVED" },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            overallRating: true,
            pros: true,
            cons: true,
            advice: true,
            body: true,
            createdAt: true,
          },
        },
        fieldProvenance: { take: 50, orderBy: { retrievalAt: "desc" } },
      },
    });

    if (!dorm) return res.status(404).json({ error: "Dorm not found" });

    const avgAgg = await prisma.dorm.aggregate({
      where: { collegeId: college.id, yearlyCost: { not: null } },
      _avg: { yearlyCost: true },
    });

    res.json({ dorm, collegeAvgCost: avgAgg._avg.yearlyCost ?? 0 });
  })
);

const compareSchema = z.object({
  ids: z.array(z.string()).min(1).max(4),
});

dormsRouter.post(
  "/compare",
  asyncHandler(async (req, res) => {
    const { ids } = compareSchema.parse(req.body);
    const dorms = await prisma.dorm.findMany({
      where: { id: { in: ids.slice(0, 4) } },
      include: { college: true, dormScore: true, dormAmenities: { include: { amenity: true } } },
    });
    res.json(dorms);
  })
);
