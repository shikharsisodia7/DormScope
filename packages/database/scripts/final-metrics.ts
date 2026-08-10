import { prisma } from "@dormscope/database";

async function main() {
  const [total, active, quarantined, scoreable, withOverall, complete, partial, blocked, berkeley, stanford, withHousing] =
    await Promise.all([
      prisma.dorm.count(),
      prisma.dorm.count({ where: { isActive: true } }),
      prisma.dorm.count({ where: { dataQualityStatus: "QUARANTINED" } }),
      prisma.dormScore.count({ where: { scoreable: true } }),
      prisma.dormScore.count({ where: { overallScore: { not: null } } }),
      prisma.college.count({ where: { housingCoverageStatus: "COMPLETE" } }),
      prisma.college.count({ where: { housingCoverageStatus: "PARTIAL" } }),
      prisma.college.findMany({
        where: { housingCoverageStatus: "BLOCKED" },
        select: { slug: true },
      }),
      prisma.dorm.count({
        where: { college: { slug: "university-of-california-berkeley" }, isActive: true },
      }),
      prisma.dorm.count({
        where: { college: { slug: "stanford-university" }, isActive: true },
      }),
      prisma.college.count({ where: { dorms: { some: { isActive: true } } } }),
    ]);
  console.log(
    JSON.stringify(
      {
        total,
        active,
        quarantined,
        scoreable,
        withOverall,
        complete,
        partial,
        blocked,
        berkeley,
        stanford,
        withHousing,
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
