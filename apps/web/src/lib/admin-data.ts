import { fuzzyDormNameMatch } from "@dormscope/shared";
import { prisma } from "@/lib/prisma";

export interface AdminOverview {
  colleges: number;
  dorms: number;
  sources: number;
  scrapeSuccessRate: number;
  avgConfidence: number;
  avgCompleteness: number;
  missingCost: number;
  missingAmenities: number;
  duplicateWarnings: { a: string; b: string; score: number }[];
  staleRecords: number;
  failedJobs: number;
}

export interface ScrapeJobRow {
  id: string;
  status: string;
  dormsFound: number;
  errorMessage: string | null;
  createdAt: Date;
  college: { name: string; slug: string };
  logs: { level: string; message: string; createdAt: Date }[];
}

export interface CoverageDashboard {
  colleges: number;
  dorms: number;
  withHousingUrl: number;
  withCoords: number;
  verifiedDorms: number;
  sourcesApproved: number;
  missingCost: number;
  housingCoverageStatus: Record<string, number>;
  coveragePct: {
    housingUrl: number;
    coords: number;
    verifiedDorms: number;
  };
}

/** Direct DB loader for admin dashboard — no HTTP self-fetch. */
export async function getAdminOverview(): Promise<AdminOverview> {
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

  return {
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
  };
}

export async function getRecentScrapeJobs(limit = 30): Promise<ScrapeJobRow[]> {
  return prisma.scrapeJob.findMany({
    include: {
      college: { select: { name: true, slug: true } },
      logs: { orderBy: { createdAt: "desc" }, take: 5 },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getCoverageDashboard(): Promise<CoverageDashboard> {
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
    prisma.college.count({ where: { AND: [{ housingUrl: { not: null } }, { NOT: { housingUrl: "" } }] } }),
    prisma.college.count({ where: { latitude: { not: null }, longitude: { not: null } } }),
    prisma.college.groupBy({ by: ["housingCoverageStatus"], _count: { _all: true } }),
    prisma.dorm.count({ where: { isVerified: true } }),
    prisma.source.count({ where: { isApproved: true } }),
    prisma.dorm.count({ where: { yearlyCost: null } }),
  ]);

  return {
    colleges,
    dorms,
    withHousingUrl,
    withCoords,
    verifiedDorms,
    sourcesApproved,
    missingCost,
    housingCoverageStatus: Object.fromEntries(byStatus.map((r) => [r.housingCoverageStatus, r._count._all])),
    coveragePct: {
      housingUrl: colleges ? Math.round((withHousingUrl / colleges) * 100) : 0,
      coords: colleges ? Math.round((withCoords / colleges) * 100) : 0,
      verifiedDorms: dorms ? Math.round((verifiedDorms / dorms) * 100) : 0,
    },
  };
}
