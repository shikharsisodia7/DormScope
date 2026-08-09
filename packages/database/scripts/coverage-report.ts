/**
 * Print institution / housing coverage stats.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npm run coverage --workspace=@dormscope/database
 */
import { PrismaClient } from "@prisma/client";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required to run the coverage report.");
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    const total = await prisma.college.count();
    const withIpeds = await prisma.college.count({ where: { ipedsUnitId: { not: null } } });
    const withHousingUrl = await prisma.college.count({
      where: { AND: [{ housingUrl: { not: null } }, { NOT: { housingUrl: "" } }] },
    });
    const residentialFlag = await prisma.college.count({ where: { hasResidentialHousing: true } });
    const confirmedNoHousing = await prisma.college.count({
      where: { OR: [{ hasResidentialHousing: false }, { housingCoverageStatus: "NO_HOUSING" }] },
    });
    const withDorms = await prisma.college.count({ where: { dorms: { some: {} } } });
    const dormCount = await prisma.dorm.count();
    const assignable = await prisma.dorm.count({ where: { isAssignableHousingOption: true } });
    const parents = await prisma.dorm.count({ where: { childHousing: { some: {} } } });
    const children = await prisma.dorm.count({ where: { parentHousingId: { not: null } } });
    const withOfficialSource = await prisma.dorm.count({
      where: { OR: [{ dormSources: { some: {} } }, { sources: { some: {} } }] },
    });

    const coverageBreakdown = await prisma.college.groupBy({
      by: ["housingCoverageStatus"],
      _count: { _all: true },
      orderBy: { _count: { housingCoverageStatus: "desc" } },
    });

    const byState = await prisma.college.groupBy({
      by: ["state"],
      _count: { _all: true },
      orderBy: { _count: { state: "desc" } },
      take: 10,
    });

    const checkpoints = await prisma.ingestCheckpoint.groupBy({
      by: ["status"],
      _count: { _all: true },
    }).catch(() => [] as Array<{ status: string; _count: { _all: number } }>);

    const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : "n/a");

    console.log("=== DormScope Institution Coverage Report ===\n");
    console.log(`Total institutions:              ${total}`);
    console.log(`With IPEDS unit id:              ${withIpeds}`);
    console.log(`Residential housing flagged:     ${residentialFlag}`);
    console.log(`Confirmed no on-campus housing:  ${confirmedNoHousing} (${pct(confirmedNoHousing, total)})`);
    console.log(`Housing site URL known:          ${withHousingUrl} (${pct(withHousingUrl, total)})`);
    console.log(`With ≥1 housing entity:          ${withDorms} (${pct(withDorms, total)})`);
    console.log(`Total housing entities:          ${dormCount}`);
    console.log(`  assignable options:            ${assignable}`);
    console.log(`  parent entities:               ${parents}`);
    console.log(`  child entities:                ${children}`);
    console.log(`  with official source link:     ${withOfficialSource}`);

    console.log("\nhousingCoverageStatus breakdown:");
    for (const row of coverageBreakdown) {
      console.log(`  ${String(row.housingCoverageStatus).padEnd(20)} ${row._count._all} (${pct(row._count._all, total)})`);
    }

    if (checkpoints.length) {
      console.log("\ningestCheckpoint status:");
      for (const row of checkpoints) {
        console.log(`  ${String(row.status).padEnd(20)} ${row._count._all}`);
      }
    }

    console.log("\nTop 10 states:");
    for (const row of byState) {
      console.log(`  ${row.state.padEnd(4)} ${row._count._all}`);
    }
    console.log("");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
