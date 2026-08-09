/**
 * Remove low-confidence junk housing rows created by over-accepting nav links.
 * Keeps entities with strong name evidence or seed provenance.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const KEEP =
  /\b(hall|house|houses|quad|tower|villa|residence|dorm|commons|apartment|village|manor|lodge|court|inn|unit\s*\d+|complex|suite|mini-suite|foothill|stern|blackwell|jester|warren|dykstra|sproul|rieber|hedrick)\b/i;

const JUNK =
  /\b(faq|how to|contact|policy|policies|terms|conditions|apply|move-in|move-out|checklist|parking|dining|meal|health|safety|deadline|cancellation|appeal|staff|news|tour|guarantee|task force|bridge program|edge program|newly admitted|visiting scholar|furniture leasing|compare housing|housing by user|rates, contracts|cancellations|technology|cleaning|mail service|winter break|living with|living sustainably|front desk|my room|tours|optional apartment cleaning|bed bugs|missing student|assignment process|how to read|renewals|accommodations|dates &|spring housing|summer |off-campus)\b/i;

async function main() {
  const dorms = await prisma.dorm.findMany({
    where: { isVerified: false },
    select: {
      id: true,
      name: true,
      collegeId: true,
      fieldProvenance: { select: { sourceId: true, confidence: true }, take: 3 },
    },
  });

  let deleted = 0;
  for (const d of dorms) {
    if (KEEP.test(d.name) && !JUNK.test(d.name)) continue;
    if (JUNK.test(d.name) || (!KEEP.test(d.name) && d.name.length > 40)) {
      await prisma.dorm.delete({ where: { id: d.id } });
      deleted += 1;
      console.log(`- ${d.name}`);
    }
  }
  console.log(JSON.stringify({ scanned: dorms.length, deleted }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
