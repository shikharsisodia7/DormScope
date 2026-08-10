/**
 * Detach clearly mismatched DormSource rows where the source URL path
 * names a different residence than the dorm (e.g. Unit 1 linked to unit-2).
 *
 * APPLY=1 to write.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.env.APPLY === "1";

function pathSlug(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    return parts[parts.length - 1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

function conflicts(dormSlug: string, dormName: string, sourceUrl: string): boolean {
  const last = pathSlug(sourceUrl);
  if (!last) return false;
  // Shared directory pages are OK
  if (
    /^(residence-halls|explore-housing-options|housing|undergraduate|graduate|apartments)$/i.test(
      last
    )
  ) {
    return false;
  }
  const dormKey = dormSlug.toLowerCase();
  const nameKey = dormName.toLowerCase().replace(/\s+/g, "-");
  // Same entity
  if (last === dormKey || last === nameKey || last.includes(dormKey) || dormKey.includes(last)) {
    return false;
  }
  // Explicit other-unit / other-hall path
  if (/^unit-\d/.test(last) && last !== dormKey) return true;
  if (/unit-\d/.test(last) && !last.includes(dormKey)) return true;
  if (/foothill|stern|clark-kerr|theme-programs/.test(last) && !dormKey.includes(last.split("-")[0])) {
    // Only when dorm is a Unit N
    if (/^unit-\d/.test(dormKey)) return true;
  }
  return false;
}

async function main() {
  const links = await prisma.dormSource.findMany({
    include: {
      dorm: { select: { id: true, slug: true, name: true } },
      source: { select: { id: true, url: true, title: true } },
    },
  });

  const toRemove: string[] = [];
  for (const row of links) {
    if (conflicts(row.dorm.slug, row.dorm.name, row.source.url)) {
      toRemove.push(row.id);
      console.log(`MISMATCH ${row.dorm.slug} ← ${row.source.url}`);
    }
  }

  if (apply && toRemove.length) {
    await prisma.dormSource.deleteMany({ where: { id: { in: toRemove } } });
  }

  // Improve titles still stuck as generic "housing page"
  const generic = await prisma.source.findMany({
    where: { title: { endsWith: "housing page" } },
    select: { id: true, url: true, title: true, finalUrl: true, canonicalUrl: true },
    take: 500,
  });
  let titlesUpdated = 0;
  for (const s of generic) {
    const last = pathSlug(s.canonicalUrl ?? s.finalUrl ?? s.url);
    if (!last || /^(residence-halls|explore-housing-options)$/i.test(last)) {
      const next = last?.includes("residence-halls")
        ? "Undergraduate residence halls directory"
        : last === "explore-housing-options"
          ? "Housing options directory"
          : null;
      if (next && apply) {
        await prisma.source.update({ where: { id: s.id }, data: { title: next } });
        titlesUpdated += 1;
      }
      continue;
    }
    const pretty = last
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    const title = `${pretty} — official housing page`;
    if (apply) {
      await prisma.source.update({ where: { id: s.id }, data: { title } });
      titlesUpdated += 1;
    }
  }

  console.log(
    JSON.stringify(
      { apply, mismatchedLinks: toRemove.length, removed: apply ? toRemove.length : 0, titlesUpdated },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
