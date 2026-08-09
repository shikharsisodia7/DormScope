/**
 * Fast batched institution import from a local Scorecard zip.
 * Idempotent via ipedsUnitId / slug. Safe to re-run while a slow import is mid-flight.
 */
import { PrismaClient, HousingCoverageStatus } from "@prisma/client";
import {
  importInstitutions,
  seedAliases,
  slugify,
  regionForState,
  ownershipToSchoolType,
  mapCsvRow,
  parseCsvLine,
  type InstitutionRecord,
} from "../src/importInstitutions";

async function loadRecordsFromZip(zipPath: string): Promise<InstitutionRecord[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AdmZip = require("adm-zip");
  const fs = await import("node:fs/promises");
  const buf = await fs.readFile(zipPath);
  const zip = new AdmZip(buf);
  const entry = zip
    .getEntries()
    .find((e: { isDirectory: boolean; entryName: string }) => !e.isDirectory && e.entryName.toLowerCase().endsWith(".csv"));
  if (!entry) throw new Error("No CSV in zip");
  const text = entry.getData().toString("utf8");
  const lines = text.split(/\r?\n/).filter((l: string) => l.length > 0);
  const headers = parseCsvLine(lines[0]);
  const records: InstitutionRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const rec = mapCsvRow(headers, parseCsvLine(lines[i]));
    if (rec) records.push(rec);
  }
  return records;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const zipPath = process.env.SCORECARD_ZIP_PATH;
  if (!databaseUrl || !zipPath) {
    console.error("DATABASE_URL and SCORECARD_ZIP_PATH required");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const records = await loadRecordsFromZip(zipPath);
  console.log(`Loaded ${records.length} records; batching upserts…`);

  const existing = await prisma.college.findMany({
    select: { ipedsUnitId: true, slug: true },
  });
  const existingIpeds = new Set(existing.map((c) => c.ipedsUnitId).filter(Boolean) as string[]);
  const existingSlugs = new Set(existing.map((c) => c.slug));

  let created = 0;
  let skippedClosed = 0;
  let skippedExisting = 0;
  const batch: Parameters<typeof prisma.college.createMany>[0]["data"] = [];

  const flush = async () => {
    if (batch.length === 0) return;
    const res = await prisma.college.createMany({ data: batch, skipDuplicates: true });
    created += res.count;
    batch.length = 0;
  };

  for (const rec of records) {
    if (!rec.operating) {
      skippedClosed += 1;
      continue;
    }
    if (rec.ipedsUnitId && existingIpeds.has(rec.ipedsUnitId)) {
      skippedExisting += 1;
      continue;
    }
    let slug = slugify(rec.name);
    if (existingSlugs.has(slug)) {
      slug = rec.ipedsUnitId ? `${slug}-${rec.ipedsUnitId}` : `${slug}-${rec.state.toLowerCase()}`;
      if (existingSlugs.has(slug)) {
        skippedExisting += 1;
        continue;
      }
    }
    existingSlugs.add(slug);
    if (rec.ipedsUnitId) existingIpeds.add(rec.ipedsUnitId);

    batch.push({
      name: rec.name,
      slug,
      city: rec.city,
      state: rec.state,
      region: regionForState(rec.state),
      schoolType: rec.schoolType,
      websiteUrl: rec.websiteUrl,
      latitude: rec.latitude,
      longitude: rec.longitude,
      studentPopulation: rec.studentPopulation,
      ipedsUnitId: rec.ipedsUnitId,
      countryCode: "US",
      hasResidentialHousing: null,
      housingCoverageStatus: HousingCoverageStatus.DISCOVERY_PENDING,
    });

    if (batch.length >= 100) await flush();
  }
  await flush();

  // aliases from CSV + manual
  let aliases = 0;
  for (const rec of records) {
    if (!rec.operating || !rec.ipedsUnitId || rec.aliases.length === 0) continue;
    const college = await prisma.college.findUnique({ where: { ipedsUnitId: rec.ipedsUnitId } });
    if (!college) continue;
    for (const alias of rec.aliases.slice(0, 8)) {
      try {
        await prisma.collegeAlias.create({
          data: { collegeId: college.id, alias, normalized: alias.toLowerCase() },
        });
        aliases += 1;
      } catch {
        // unique violation ok
      }
    }
  }

  const seeded = await seedAliases(prisma);
  console.log(JSON.stringify({ created, skippedClosed, skippedExisting, aliases, seeded }, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
