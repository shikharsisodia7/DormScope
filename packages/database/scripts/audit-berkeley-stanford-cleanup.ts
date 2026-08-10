import { prisma, DataQualityStatus } from "@dormscope/database";
import { assessHousingName } from "./lib/junk-housing";

const EXTRA_JUNK =
  /^(ESAs and Service Animals|Transit and Transportation|Graduate Students|Temporary Quad Room|Housing for Continuing Students|Apartment Features|Apartment Layouts|Apartments & Suites|Apartments and Suites|High-Rise|Low-Rise|Residence|Single Graduate Housing|Single Undergraduate Housing|Stanford On-campus Housing Amenities|On-campus Housing Options for 2026-27|Northeast Campus Residence Halls|South Campus Residence Halls|Southeast Campus Residence Halls|Helen Diller Anchor House Spaces|The Unity House Theme Program|UNITY Theme Program.*|African American \(AATP\).*|Bloom Asian American.*|Casa Magdalena Mora.*|Empowering Womxn.*|Native American \(NATP\).*)$/i;

async function main() {
  const apply = process.env.APPLY === "1";

  // Restore likely-good apartments false-quarantined by initials
  const restoreTargets = await prisma.dorm.findMany({
    where: {
      dataQualityStatus: "QUARANTINED",
      name: { contains: "Apartment", mode: "insensitive" },
    },
    select: { id: true, name: true, college: { select: { slug: true } } },
  });

  let restored = 0;
  for (const d of restoreTargets) {
    const a = assessHousingName(d.name);
    if (!a.isJunk) {
      if (apply) {
        await prisma.dorm.update({
          where: { id: d.id },
          data: {
            isActive: true,
            dataQualityStatus: DataQualityStatus.ACTIVE,
            quarantineReason: null,
            quarantinedAt: null,
            quarantinedBy: null,
          },
        });
      }
      restored += 1;
      console.log(`RESTORE ${d.college.slug}: ${d.name}`);
    }
  }

  // Extra quarantine for known junk marketing/nav leftovers
  const active = await prisma.dorm.findMany({
    where: {
      isActive: true,
      dataQualityStatus: { not: "QUARANTINED" },
      OR: [
        { college: { slug: "university-of-california-berkeley" } },
        { college: { slug: "stanford-university" } },
      ],
    },
    select: { id: true, name: true, college: { select: { slug: true } } },
  });

  let quarantined = 0;
  for (const d of active) {
    if (!EXTRA_JUNK.test(d.name) && !assessHousingName(d.name).isJunk) continue;
    // Never quarantine core Unit 1/2/3, named halls
    if (/^Unit\s*[123]$/i.test(d.name)) continue;
    if (/^(Foothill|Stern|Blackwell Hall|Martinez Commons|Towle Hall|Clark Kerr|Branner Hall|Wilbur Hall|Roble Hall|Toyon Hall|Stern Hall|Crothers Hall|Florence Moore Hall)$/i.test(d.name)) {
      continue;
    }
    if (EXTRA_JUNK.test(d.name) || assessHousingName(d.name).isJunk) {
      if (apply) {
        await prisma.dorm.update({
          where: { id: d.id },
          data: {
            isActive: false,
            dataQualityStatus: DataQualityStatus.QUARANTINED,
            quarantineReason: EXTRA_JUNK.test(d.name)
              ? "marketing_or_nav_heading"
              : assessHousingName(d.name).reason,
            quarantinedAt: new Date(),
            quarantinedBy: "audit-berkeley-stanford",
          },
        });
      }
      quarantined += 1;
      console.log(`QUARANTINE ${d.college.slug}: ${d.name}`);
    }
  }

  const michigan = await prisma.college.findMany({
    where: { name: { contains: "Michigan", mode: "insensitive" }, OR: [{ slug: { contains: "ann-arbor" } }, { housingCoverageStatus: "BLOCKED" }] },
    select: { slug: true, name: true, housingCoverageStatus: true },
  });
  const blocked = await prisma.college.findMany({
    where: { housingCoverageStatus: "BLOCKED" },
    select: { slug: true, name: true },
  });

  console.log(JSON.stringify({ apply, restored, quarantined, michigan, blocked }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
