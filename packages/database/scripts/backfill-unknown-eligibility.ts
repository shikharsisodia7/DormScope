/**
 * Backfill: eligibility / character booleans that only existed as schema defaults
 * (with no supporting FieldProvenance) become null = unknown.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FACT_FIELDS = [
  "freshmanEligible",
  "upperclassEligible",
  "honorsHousing",
  "themedHousing",
  "genderInclusive",
] as const;

async function main() {
  const dorms = await prisma.dorm.findMany({
    select: {
      id: true,
      freshmanEligible: true,
      upperclassEligible: true,
      honorsHousing: true,
      themedHousing: true,
      genderInclusive: true,
      isVerified: true,
      fieldProvenance: {
        where: { fieldName: { in: [...FACT_FIELDS] } },
        select: { fieldName: true, verified: true },
      },
    },
  });

  let updated = 0;
  for (const d of dorms) {
    const proven = new Set(d.fieldProvenance.map((p) => p.fieldName));
    const data: Record<string, boolean | null> = {};

    for (const field of FACT_FIELDS) {
      if (proven.has(field)) continue; // keep values with provenance
      if (d.isVerified) continue; // keep human-verified rows intact
      // Defaulted affirmative/negative without evidence → unknown
      data[field] = null;
    }

    if (Object.keys(data).length === 0) continue;
    await prisma.dorm.update({ where: { id: d.id }, data });
    updated += 1;
  }

  console.log(JSON.stringify({ dorms: dorms.length, updated }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
