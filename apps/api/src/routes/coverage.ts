import { Router } from "express";
import { prisma } from "@dormscope/database";
import { requireAdminKey } from "../middleware/adminAuth.js";
import { asyncHandler } from "../middleware/errorHandler.js";

export const coverageRouter = Router();

coverageRouter.get(
  "/",
  requireAdminKey,
  asyncHandler(async (_req, res) => {
    const [
      colleges,
      dorms,
      withHousingUrl,
      withCoords,
      byStatus,
      verifiedDorms,
      sourcesApproved,
      missingCost,
    ] = await Promise.all([
      prisma.college.count(),
      prisma.dorm.count(),
      prisma.college.count({ where: { housingUrl: { not: null } } }),
      prisma.college.count({ where: { latitude: { not: null }, longitude: { not: null } } }),
      prisma.college.groupBy({ by: ["housingCoverageStatus"], _count: true }),
      prisma.dorm.count({ where: { isVerified: true } }),
      prisma.source.count({ where: { isApproved: true } }),
      prisma.dorm.count({ where: { yearlyCost: null } }),
    ]);

    res.json({
      colleges,
      dorms,
      withHousingUrl,
      withCoords,
      verifiedDorms,
      sourcesApproved,
      missingCost,
      housingCoverageStatus: Object.fromEntries(
        byStatus.map((r) => [r.housingCoverageStatus, r._count])
      ),
      coveragePct: {
        housingUrl: colleges ? Math.round((withHousingUrl / colleges) * 100) : 0,
        coords: colleges ? Math.round((withCoords / colleges) * 100) : 0,
        verifiedDorms: dorms ? Math.round((verifiedDorms / dorms) * 100) : 0,
      },
    });
  })
);
