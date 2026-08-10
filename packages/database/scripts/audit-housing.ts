/**
 * Report suspicious housing entities grouped by college (read-only).
 */
import { createScriptPrisma } from "./lib/script-utils";
import { findJunkCandidates } from "./lib/find-junk-candidates";

async function main() {
  const prisma = createScriptPrisma();

  try {
    const candidates = await findJunkCandidates(prisma);
    const grouped: Record<
      string,
      { college: string; slug: string; entities: { id: string; name: string; reason: string }[] }
    > = {};

    for (const c of candidates) {
      if (!grouped[c.collegeId]) {
        grouped[c.collegeId] = { college: c.collegeName, slug: c.collegeSlug, entities: [] };
      }
      grouped[c.collegeId].entities.push({ id: c.id, name: c.name, reason: c.reason });
    }

    const colleges = Object.values(grouped).sort((a, b) => b.entities.length - a.entities.length);

    console.log("=== Housing audit (suspicious entities) ===\n");
    console.log(`Colleges with suspicious entities: ${colleges.length}`);
    console.log(`Total suspicious entities:       ${candidates.length}\n`);

    for (const row of colleges.slice(0, 50)) {
      console.log(`${row.college} (${row.slug}) — ${row.entities.length} suspicious`);
      for (const e of row.entities.slice(0, 8)) {
        console.log(`  • [${e.reason}] ${e.name}`);
      }
      if (row.entities.length > 8) console.log(`  … and ${row.entities.length - 8} more`);
      console.log("");
    }

    console.log(
      JSON.stringify(
        {
          colleges: colleges.length,
          suspiciousEntities: candidates.length,
          topColleges: colleges.slice(0, 10).map((c) => ({
            slug: c.slug,
            college: c.college,
            count: c.entities.length,
          })),
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
