import { prisma, DataQualityStatus } from "@dormscope/database";

async function main() {
  const restored = await prisma.dorm.updateMany({
    where: {
      name: "John R. Lewis College",
      college: { slug: "university-of-california-santa-cruz" },
    },
    data: {
      isActive: true,
      dataQualityStatus: DataQualityStatus.ACTIVE,
      quarantineReason: null,
      quarantinedAt: null,
      quarantinedBy: null,
    },
  });

  const berkeley = await prisma.dorm.findMany({
    where: { college: { slug: { contains: "berkeley" } }, isActive: true },
    select: { name: true, slug: true, dataQualityStatus: true },
    orderBy: { name: "asc" },
  });

  const stanfordCollege = await prisma.college.findFirst({
    where: { slug: { contains: "stanford" } },
    select: {
      slug: true,
      housingCoverageStatus: true,
      housingUrl: true,
    },
  });

  const stanfordDorms = await prisma.dorm.findMany({
    where: { college: { slug: { contains: "stanford" } } },
    select: { name: true, isActive: true, dataQualityStatus: true },
    orderBy: { name: "asc" },
  });

  const michigan = await prisma.college.findFirst({
    where: {
      OR: [
        { slug: { contains: "university-of-michigan" } },
        { name: { equals: "University of Michigan-Ann Arbor" } },
      ],
    },
    select: { slug: true, name: true, housingCoverageStatus: true },
  });

  const complete = await prisma.college.findMany({
    where: { housingCoverageStatus: "COMPLETE" },
    select: { slug: true, name: true },
  });

  const quarantined = await prisma.dorm.count({
    where: { dataQualityStatus: "QUARANTINED" },
  });
  const active = await prisma.dorm.count({ where: { isActive: true } });
  const scoreable = await prisma.dormScore.count({ where: { scoreable: true } });
  const withOverall = await prisma.dormScore.count({
    where: { overallScore: { not: null } },
  });

  console.log(
    JSON.stringify(
      {
        restored: restored.count,
        berkeleyCount: berkeley.length,
        berkeleyNames: berkeley.map((d) => d.name),
        stanford: stanfordCollege,
        stanfordActive: stanfordDorms.filter((d) => d.isActive).length,
        stanfordQuarantined: stanfordDorms.filter(
          (d) => d.dataQualityStatus === "QUARANTINED"
        ).length,
        stanfordNames: stanfordDorms.filter((d) => d.isActive).map((d) => d.name),
        michigan,
        complete,
        quarantined,
        active,
        scoreable,
        withOverall,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
