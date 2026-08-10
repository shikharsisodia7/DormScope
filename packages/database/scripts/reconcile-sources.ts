/**
 * Link legacy Source.dormId rows into DormSource join table.
 *
 * Usage:
 *   DATABASE_URL=... npm run reconcile:sources --workspace=@dormscope/database
 *   APPLY=1 DATABASE_URL=... npm run reconcile:sources --workspace=@dormscope/database
 */
import { createScriptPrisma, isApplyMode, printModeBanner } from "./lib/script-utils";

async function main() {
  const apply = isApplyMode();
  printModeBanner(apply);
  const prisma = createScriptPrisma();

  try {
    const legacy = await prisma.source.findMany({
      where: { dormId: { not: null } },
      select: { id: true, dormId: true, pageRole: true, url: true },
    });

    let linked = 0;
    let skipped = 0;

    for (const src of legacy) {
      if (!src.dormId) continue;
      const existing = await prisma.dormSource.findUnique({
        where: { dormId_sourceId: { dormId: src.dormId, sourceId: src.id } },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      if (apply) {
        await prisma.dormSource.create({
          data: {
            dormId: src.dormId,
            sourceId: src.id,
            role: src.pageRole ?? "legacy",
          },
        });
      }
      linked += 1;
    }

    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry_run",
          legacySources: legacy.length,
          wouldLink: linked,
          alreadyLinked: skipped,
          linked: apply ? linked : 0,
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
