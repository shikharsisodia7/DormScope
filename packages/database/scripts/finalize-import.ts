import { PrismaClient } from "@prisma/client";
import { seedAliases } from "../src/importInstitutions";

async function main() {
  const prisma = new PrismaClient();
  const n = await seedAliases(prisma);
  const ut = await prisma.college.findFirst({
    where: {
      OR: [
        { name: { contains: "Texas at Austin", mode: "insensitive" } },
        { slug: { contains: "texas-at-austin" } },
      ],
    },
  });
  console.log(
    JSON.stringify(
      {
        seededAliases: n,
        colleges: await prisma.college.count(),
        dorms: await prisma.dorm.count(),
        states: (
          await prisma.college.findMany({ distinct: ["state"], select: { state: true } })
        ).length,
        ut: ut ? { name: ut.name, slug: ut.slug } : null,
      },
      null,
      2
    )
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
