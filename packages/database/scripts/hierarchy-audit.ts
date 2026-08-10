/**
 * Audit housing hierarchy consistency (read-only).
 */
import { createScriptPrisma } from "./lib/script-utils";

async function main() {
  const prisma = createScriptPrisma();

  try {
    const [orphanChildren, selfParents, inactiveParents, deepTrees] = await Promise.all([
      prisma.dorm.findMany({
        where: {
          parentHousingId: { not: null },
          parentHousing: null,
        },
        select: { id: true, name: true, parentHousingId: true, college: { select: { slug: true, name: true } } },
        take: 100,
      }),
      prisma.$queryRaw<Array<{ id: string; name: string }>>`
        SELECT id, name FROM "Dorm" WHERE "parentHousingId" = id LIMIT 100
      `,
      prisma.dorm.findMany({
        where: {
          childHousing: { some: {} },
          OR: [{ isActive: false }, { dataQualityStatus: { not: "ACTIVE" } }],
        },
        select: {
          id: true,
          name: true,
          dataQualityStatus: true,
          isActive: true,
          college: { select: { slug: true, name: true } },
          _count: { select: { childHousing: true } },
        },
        take: 100,
      }),
      prisma.dorm.findMany({
        where: {
          parentHousing: { parentHousingId: { not: null } },
        },
        select: {
          id: true,
          name: true,
          college: { select: { slug: true, name: true } },
          parentHousing: { select: { name: true, parentHousingId: true } },
        },
        take: 100,
      }),
    ]);

    const assignableWithoutParent = await prisma.dorm.count({
      where: {
        isAssignableHousingOption: true,
        entityKind: { in: ["UNIT", "BUILDING", "HOUSE"] },
        parentHousingId: null,
        childHousing: { none: {} },
      },
    });

    console.log("=== Housing hierarchy audit ===\n");
    console.log(`Orphan children (missing parent):     ${orphanChildren.length}`);
    console.log(`Self-referencing parents:             ${selfParents.length}`);
    console.log(`Inactive/quarantined parents w/ kids: ${inactiveParents.length}`);
    console.log(`Depth >= 3 (grandchild rows):         ${deepTrees.length}`);
    console.log(`Assignable leaf units w/o parent:     ${assignableWithoutParent}`);

    const printSample = (
      label: string,
      rows: Array<{ name: string; college?: { slug: string; name: string } }>
    ) => {
      if (!rows.length) return;
      console.log(`\n${label}:`);
      for (const r of rows.slice(0, 10)) {
        console.log(`  • ${r.college?.name ?? "?"} (${r.college?.slug ?? "?"}) — ${r.name}`);
      }
    };

    printSample("Orphan children", orphanChildren);
    printSample("Self parents", selfParents.map((r) => ({ name: r.name })));
    printSample("Inactive parents", inactiveParents);

    console.log(
      JSON.stringify(
        {
          orphanChildren: orphanChildren.length,
          selfParents: selfParents.length,
          inactiveParents: inactiveParents.length,
          deepTrees: deepTrees.length,
          assignableLeafWithoutParent: assignableWithoutParent,
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
