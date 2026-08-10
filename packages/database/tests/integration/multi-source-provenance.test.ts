/**
 * Integration: multi-source provenance
 *
 * Two independent sources both report hasAC=true.  Both FieldProvenance rows
 * must be stored (one per source) — the uniqueness guard is application-level
 * (same field+value+sourceId deduplicates within a source, but a second source
 * recording the same value is a distinct, valid provenance event).
 *
 * Also verifies that DormSource records for both sources are independently
 * kept, and that the @@unique([dormId, sourceId]) constraint allows two
 * different sources to link to the same dorm.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, SourceType } from "@prisma/client";
import {
  seedIntegrationFixtures,
  cleanupIntegrationFixtures,
  type IntegrationFixtures,
} from "../../src/integration/fixtures.js";

const prisma = new PrismaClient();
let fixtures: IntegrationFixtures;

beforeAll(async () => {
  fixtures = await seedIntegrationFixtures(prisma);
});

afterAll(async () => {
  await cleanupIntegrationFixtures(prisma);
  await prisma.$disconnect();
});

describe("multi-source provenance", () => {
  test("two sources both reporting AC=true → two FieldProvenance rows", async () => {
    const { unit1 } = fixtures.dorms;
    const { berkeley } = fixtures.colleges;

    const srcA = await prisma.source.create({
      data: {
        url: "https://housing.berkeley-fixture.test/unit1/details-a",
        canonicalUrl: "https://housing.berkeley-fixture.test/unit1/details-a",
        collegeId: berkeley.id,
        sourceType: SourceType.OFFICIAL_WEBSITE,
        confidence: 0.9,
      },
    });

    const srcB = await prisma.source.create({
      data: {
        url: "https://housing.berkeley-fixture.test/unit1/details-b",
        canonicalUrl: "https://housing.berkeley-fixture.test/unit1/details-b",
        collegeId: berkeley.id,
        sourceType: SourceType.OFFICIAL_WEBSITE,
        confidence: 0.8,
      },
    });

    // Application-level guard: skip if same field+value+sourceId already present
    const alreadyFromA = await prisma.fieldProvenance.findFirst({
      where: { dormId: unit1.id, fieldName: "hasAC", valueSnapshot: "true", sourceId: srcA.id },
    });
    if (!alreadyFromA) {
      await prisma.fieldProvenance.create({
        data: {
          dormId: unit1.id,
          collegeId: berkeley.id,
          fieldName: "hasAC",
          valueSnapshot: "true",
          sourceId: srcA.id,
          sourceUrl: srcA.url,
          confidence: 0.9,
        },
      });
    }

    const alreadyFromB = await prisma.fieldProvenance.findFirst({
      where: { dormId: unit1.id, fieldName: "hasAC", valueSnapshot: "true", sourceId: srcB.id },
    });
    if (!alreadyFromB) {
      await prisma.fieldProvenance.create({
        data: {
          dormId: unit1.id,
          collegeId: berkeley.id,
          fieldName: "hasAC",
          valueSnapshot: "true",
          sourceId: srcB.id,
          sourceUrl: srcB.url,
          confidence: 0.8,
        },
      });
    }

    const rows = await prisma.fieldProvenance.findMany({
      where: {
        dormId: unit1.id,
        fieldName: "hasAC",
        valueSnapshot: "true",
        sourceId: { in: [srcA.id, srcB.id] },
      },
    });

    // Both sources independently attested the same value → two provenance rows.
    expect(rows).toHaveLength(2);
    const sourceIds = rows.map((r) => r.sourceId);
    expect(sourceIds).toContain(srcA.id);
    expect(sourceIds).toContain(srcB.id);

    // Cleanup
    await prisma.fieldProvenance.deleteMany({
      where: { dormId: unit1.id, fieldName: "hasAC", sourceId: { in: [srcA.id, srcB.id] } },
    });
    await prisma.source.deleteMany({ where: { id: { in: [srcA.id, srcB.id] } } });
  });

  test("two DormSource links from different sources → both kept (no dedup)", async () => {
    const { unit2 } = fixtures.dorms;
    const { berkeley } = fixtures.colleges;

    const src1 = await prisma.source.create({
      data: {
        url: "https://housing.berkeley-fixture.test/unit2/src1",
        canonicalUrl: "https://housing.berkeley-fixture.test/unit2/src1",
        collegeId: berkeley.id,
        sourceType: SourceType.OFFICIAL_WEBSITE,
        confidence: 0.85,
      },
    });

    const src2 = await prisma.source.create({
      data: {
        url: "https://housing.berkeley-fixture.test/unit2/src2",
        canonicalUrl: "https://housing.berkeley-fixture.test/unit2/src2",
        collegeId: berkeley.id,
        sourceType: SourceType.OFFICIAL_WEBSITE,
        confidence: 0.75,
      },
    });

    await prisma.dormSource.upsert({
      where: { dormId_sourceId: { dormId: unit2.id, sourceId: src1.id } },
      create: { dormId: unit2.id, sourceId: src1.id, role: "detail" },
      update: {},
    });

    await prisma.dormSource.upsert({
      where: { dormId_sourceId: { dormId: unit2.id, sourceId: src2.id } },
      create: { dormId: unit2.id, sourceId: src2.id, role: "detail" },
      update: {},
    });

    const links = await prisma.dormSource.findMany({
      where: { dormId: unit2.id, sourceId: { in: [src1.id, src2.id] } },
    });
    expect(links).toHaveLength(2);

    // Cleanup
    await prisma.dormSource.deleteMany({
      where: { dormId: unit2.id, sourceId: { in: [src1.id, src2.id] } },
    });
    await prisma.source.deleteMany({ where: { id: { in: [src1.id, src2.id] } } });
  });

  test("same source linked twice → idempotent (one DormSource row)", async () => {
    const { unit1 } = fixtures.dorms;
    const { berkeley } = fixtures.colleges;

    const src = await prisma.source.create({
      data: {
        url: "https://housing.berkeley-fixture.test/unit1/dup-src",
        canonicalUrl: "https://housing.berkeley-fixture.test/unit1/dup-src",
        collegeId: berkeley.id,
        sourceType: SourceType.OFFICIAL_WEBSITE,
        confidence: 0.85,
      },
    });

    for (let i = 0; i < 3; i++) {
      await prisma.dormSource.upsert({
        where: { dormId_sourceId: { dormId: unit1.id, sourceId: src.id } },
        create: { dormId: unit1.id, sourceId: src.id, role: "directory" },
        update: {},
      });
    }

    const count = await prisma.dormSource.count({
      where: { dormId: unit1.id, sourceId: src.id },
    });
    expect(count).toBe(1);

    // Cleanup
    await prisma.dormSource.deleteMany({ where: { dormId: unit1.id, sourceId: src.id } });
    await prisma.source.delete({ where: { id: src.id } });
  });
});
