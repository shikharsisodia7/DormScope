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

    const byState = await prisma.college.groupBy({
      by: ["state"],
      _count: { _all: true },
      orderBy: { _count: { state: "desc" } },
      take: 10,
    });

    const withHousingUrl = await prisma.college.count({
      where: { housingUrl: { not: null } },
    });

    // housingUrl that is also non-empty
    const withNonEmptyHousingUrl = await prisma.college.count({
      where: {
        AND: [{ housingUrl: { not: null } }, { NOT: { housingUrl: "" } }],
      },
    });

    const withDorms = await prisma.college.count({
      where: { dorms: { some: {} } },
    });

    const dormCount = await prisma.dorm.count();

    const coverageBreakdown = await prisma.college.groupBy({
      by: ["housingCoverageStatus"],
      _count: { _all: true },
      orderBy: { _count: { housingCoverageStatus: "desc" } },
    });

    const withIpeds = await prisma.college.count({
      where: { ipedsUnitId: { not: null } },
    });

    console.log("=== DormScope Institution Coverage Report ===\n");
    console.log(`Total institutions: ${total}`);
    console.log(`With IPEDS unit id: ${withIpeds}`);
    console.log(`With housingUrl:    ${withNonEmptyHousingUrl} (non-null: ${withHousingUrl})`);
    console.log(`With dorms:         ${withDorms} colleges / ${dormCount} dorm rows`);

    console.log("\nTop 10 states:");
    for (const row of byState) {
      console.log(`  ${row.state.padEnd(4)} ${row._count._all}`);
    }

    console.log("\nhousingCoverageStatus breakdown:");
    for (const row of coverageBreakdown) {
      console.log(`  ${String(row.housingCoverageStatus).padEnd(20)} ${row._count._all}`);
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
