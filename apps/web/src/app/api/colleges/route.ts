import { Prisma } from "@dormscope/database";
import { prisma } from "@/lib/prisma";
import { jsonOk, handleRouteError, parsePagination, normalizeSearchQuery } from "@/lib/api";

export const dynamic = "force-dynamic";

function relevanceScore(
  college: {
    name: string;
    shortName: string | null;
    city: string;
    studentPopulation: number | null;
    dormCount: number;
    aliases: { alias: string }[];
  },
  qRaw: string,
  q: string
): number {
  const name = college.name.toLowerCase();
  const raw = qRaw.toLowerCase();
  let score = 0;

  if (name === raw || name === q) score += 1000;
  if (college.shortName?.toLowerCase() === raw) score += 900;
  if (college.aliases.some((a) => a.alias.toLowerCase() === raw)) score += 900;
  if (name.startsWith(raw) || name.startsWith(q)) score += 500;
  if (college.aliases.some((a) => a.alias.toLowerCase().startsWith(raw))) score += 400;
  if (name.includes(` ${raw}`) || name.includes(raw)) score += 100;
  // Prefer schools that already have residence halls in DormScope
  score += Math.min(200, college.dormCount * 40);
  // Prefer larger institutions slightly (main campuses over tiny institutes)
  score += Math.min(50, Math.floor((college.studentPopulation ?? 0) / 2000));
  // Penalize substring traps for short queries (e.g. "scu" inside "escuela")
  if (raw.length <= 3 && !college.aliases.some((a) => a.alias.toLowerCase() === raw) && college.shortName?.toLowerCase() !== raw && !name.startsWith(raw)) {
    score -= 300;
  }
  return score;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const qRaw = searchParams.get("q")?.trim() ?? "";
    const q = normalizeSearchQuery(qRaw);
    const state = searchParams.get("state") ?? undefined;
    const { page, pageSize, skip } = parsePagination(searchParams);

    const isShort = qRaw.length > 0 && qRaw.length <= 3;

    const where: Prisma.CollegeWhereInput = {
      AND: [
        state ? { state } : {},
        q
          ? isShort
            ? {
                OR: [
                  { shortName: { equals: qRaw, mode: "insensitive" } },
                  { aliases: { some: { alias: { equals: qRaw, mode: "insensitive" } } } },
                  { name: { startsWith: qRaw, mode: "insensitive" } },
                  // Still allow contains but we'll re-rank; keep alias equals primary
                  { aliases: { some: { alias: { equals: q, mode: "insensitive" } } } },
                ],
              }
            : {
                OR: [
                  { name: { contains: qRaw, mode: "insensitive" } },
                  { name: { contains: q, mode: "insensitive" } },
                  { officialName: { contains: qRaw, mode: "insensitive" } },
                  { shortName: { contains: qRaw, mode: "insensitive" } },
                  { city: { contains: qRaw, mode: "insensitive" } },
                  { aliases: { some: { alias: { contains: qRaw, mode: "insensitive" } } } },
                  { aliases: { some: { alias: { contains: q, mode: "insensitive" } } } },
                ],
              }
          : {},
      ],
    };

    // Fetch a wider window then re-rank for relevance (avoids "Escuela" beating "SCU")
    const fetchTake = Math.min(200, Math.max(pageSize * 5, 50));

    const [total, colleges] = await Promise.all([
      prisma.college.count({ where }),
      prisma.college.findMany({
        where,
        include: {
          _count: { select: { dorms: true } },
          aliases: { select: { alias: true }, take: 8 },
        },
        take: fetchTake,
      }),
    ]);

    const ranked = colleges
      .map((c) => ({
        ...c,
        dormCount: c._count.dorms,
        _relevance: qRaw ? relevanceScore({ ...c, dormCount: c._count.dorms }, qRaw, q) : 0,
      }))
      .sort((a, b) => {
        if (b._relevance !== a._relevance) return b._relevance - a._relevance;
        return a.name.localeCompare(b.name);
      });

    const pageItems = ranked.slice(skip, skip + pageSize).map((row) => {
      const { _relevance: _r, ...c } = row;
      void _r;
      return {
        ...c,
        dormCount: c._count.dorms,
        hasResidentialHousing: c.hasResidentialHousing,
        housingCoverageStatus: c.housingCoverageStatus,
      };
    });

    return jsonOk({
      items: pageItems,
      colleges: pageItems,
      total: qRaw ? ranked.length : total,
      page,
      pageSize,
      totalPages: Math.ceil((qRaw ? ranked.length : total) / pageSize) || 0,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
