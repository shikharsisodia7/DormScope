/**
 * E2E seed helper — seeds integration fixtures into the test database.
 *
 * Usage:
 *   DATABASE_URL_TEST=postgresql://... tsx apps/web/e2e/helpers/seed.ts
 *   npm run db:seed-e2e
 */
import { PrismaClient } from "@prisma/client";
import { seedIntegrationFixtures } from "@dormscope/database/integration";

async function main() {
  const dbUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error("❌  DATABASE_URL_TEST (or DATABASE_URL) must be set to run E2E seed.");
    process.exit(1);
  }

  if (process.env.DATABASE_URL_TEST) {
    process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
  }

  const prisma = new PrismaClient();
  try {
    console.log("🌱  Seeding E2E fixtures…");
    const fixtures = await seedIntegrationFixtures(prisma);

    console.log("✓  Colleges seeded:");
    for (const [key, college] of Object.entries(fixtures.colleges)) {
      console.log(`     ${key}: ${college.slug} (${college.housingCoverageStatus})`);
    }

    console.log("✓  Dorms seeded:");
    for (const [key, dorm] of Object.entries(fixtures.dorms)) {
      console.log(`     ${key}: ${dorm.name} (${dorm.slug})`);
    }

    console.log("✅  E2E fixtures ready.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
