/**
 * Import US higher-ed institutions from College Scorecard into College rows.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npm run import:institutions --workspace=@dormscope/database
 *
 * Options (env):
 *   COLLEGE_SCORECARD_API_KEY  — defaults to DEMO_KEY
 *   IMPORT_SOURCE              — auto | api | csv (default auto)
 *   IMPORT_MAX_PAGES           — optional page cap for API dry runs
 *   SKIP_SEED_ALIASES          — set to "1" to skip manual alias seeding
 */
import { PrismaClient } from "@prisma/client";
import { importInstitutions } from "../src/importInstitutions";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required to run the institution importer.");
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  const sourceEnv = (process.env.IMPORT_SOURCE ?? "auto").toLowerCase();
  const source =
    sourceEnv === "api" || sourceEnv === "csv" || sourceEnv === "auto"
      ? sourceEnv
      : "auto";

  const maxPagesRaw = process.env.IMPORT_MAX_PAGES;
  const maxPages = maxPagesRaw ? Number(maxPagesRaw) : undefined;

  try {
    const result = await importInstitutions({
      prisma,
      source,
      apiKey: process.env.COLLEGE_SCORECARD_API_KEY ?? "DEMO_KEY",
      maxPages: Number.isFinite(maxPages) ? maxPages : undefined,
      skipSeedAliases: process.env.SKIP_SEED_ALIASES === "1",
    });

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
