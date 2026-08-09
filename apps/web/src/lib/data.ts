import { prisma } from "@/lib/prisma";
import { buildCollegeHighlights } from "@/lib/college-helpers";

/** Direct DB loaders for Server Components — never HTTP self-fetch on Vercel. */

export async function getCollegeBySlug(slug: string) {
  const college = await prisma.college.findUnique({
    where: { slug },
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
      aliases: { select: { alias: true } },
      campuses: true,
    },
  });
  if (!college) return null;

  return {
    ...college,
    dormCount: college.dorms.length,
    highlights: buildCollegeHighlights(college.dorms),
  };
}

export async function getDormBySlugs(collegeSlug: string, dormSlug: string) {
  const college = await prisma.college.findUnique({ where: { slug: collegeSlug } });
  if (!college) return null;

  const dorm = await prisma.dorm.findUnique({
    where: { collegeId_slug: { collegeId: college.id, slug: dormSlug } },
    include: {
      college: true,
      dormScore: true,
      roomTypes: true,
      dormAmenities: { include: { amenity: true } },
      housingCosts: true,
      sources: { where: { isApproved: true }, orderBy: { createdAt: "desc" } },
      reviewSummaries: true,
      reviews: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          overallRating: true,
          categoryRatings: true,
          schoolYear: true,
          classYearLived: true,
          roomTypeLived: true,
          pros: true,
          cons: true,
          advice: true,
          body: true,
          createdAt: true,
        },
      },
      fieldProvenance: {
        orderBy: { retrievalAt: "desc" },
        take: 50,
        include: { source: { select: { id: true, url: true, title: true, isApproved: true } } },
      },
    },
  });
  if (!dorm) return null;

  const costAgg = await prisma.dorm.aggregate({
    where: { collegeId: college.id, yearlyCost: { not: null } },
    _avg: { yearlyCost: true },
  });

  return {
    dorm,
    collegeAvgCost: costAgg._avg.yearlyCost ?? 0,
  };
}

export async function searchColleges(opts: {
  q?: string;
  state?: string;
  pageSize?: number;
}) {
  const qRaw = opts.q?.trim() ?? "";
  const q = qRaw.toLowerCase();
  const pageSize = opts.pageSize ?? 48;
  const isShort = qRaw.length > 0 && qRaw.length <= 3;

  const where = {
    AND: [
      opts.state ? { state: opts.state } : {},
      q
        ? isShort
          ? {
              OR: [
                { shortName: { equals: qRaw, mode: "insensitive" as const } },
                { aliases: { some: { alias: { equals: qRaw, mode: "insensitive" as const } } } },
                { name: { startsWith: qRaw, mode: "insensitive" as const } },
              ],
            }
          : {
              OR: [
                { name: { contains: qRaw, mode: "insensitive" as const } },
                { shortName: { contains: qRaw, mode: "insensitive" as const } },
                { city: { contains: qRaw, mode: "insensitive" as const } },
                { aliases: { some: { alias: { contains: qRaw, mode: "insensitive" as const } } } },
              ],
            }
        : {},
    ],
  };

  const colleges = await prisma.college.findMany({
    where,
    include: {
      _count: { select: { dorms: true } },
      aliases: { select: { alias: true }, take: 5 },
    },
    take: Math.min(200, pageSize * 4),
  });

  const scored = colleges
    .map((c) => {
      const name = c.name.toLowerCase();
      let score = 0;
      if (name === q) score += 1000;
      if (c.shortName?.toLowerCase() === q) score += 900;
      if (c.aliases.some((a) => a.alias.toLowerCase() === q)) score += 900;
      if (name.startsWith(q)) score += 500;
      score += Math.min(200, c._count.dorms * 40);
      score += Math.min(50, Math.floor((c.studentPopulation ?? 0) / 2000));
      if (
        qRaw.length <= 3 &&
        !c.aliases.some((a) => a.alias.toLowerCase() === q) &&
        c.shortName?.toLowerCase() !== q &&
        !name.startsWith(q)
      ) {
        score -= 300;
      }
      return { ...c, dormCount: c._count.dorms, _score: score };
    })
    .sort((a, b) => b._score - a._score || a.name.localeCompare(b.name))
    .slice(0, pageSize);

  return scored.map(({ _score, ...c }) => c);
}

export async function searchDorms(searchParams: Record<string, string | undefined>) {
  const where: Record<string, unknown> = { isActive: true };
  const and: Record<string, unknown>[] = [];

  if (searchParams.q) {
    and.push({ name: { contains: searchParams.q, mode: "insensitive" } });
  }
  if (searchParams.state) {
    and.push({ college: { state: searchParams.state } });
  }
  if (searchParams.hasAC === "true") and.push({ hasAC: true });
  if (searchParams.freshmanOnly === "true") and.push({ freshmanEligible: true });
  if (searchParams.bathroomStyle) and.push({ bathroomStyle: searchParams.bathroomStyle });
  if (searchParams.dormType) and.push({ dormType: searchParams.dormType });
  if (searchParams.minCost) and.push({ yearlyCost: { gte: Number(searchParams.minCost) } });
  if (searchParams.maxCost) and.push({ yearlyCost: { lte: Number(searchParams.maxCost) } });

  if (and.length) where.AND = and;

  return prisma.dorm.findMany({
    where,
    include: {
      college: { select: { name: true, slug: true, state: true } },
      dormScore: true,
    },
    orderBy: [{ dormScore: { overallScore: "desc" } }, { name: "asc" }],
    take: 60,
  });
}
