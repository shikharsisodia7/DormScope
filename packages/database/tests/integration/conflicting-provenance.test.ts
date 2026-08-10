/**
 * Integration: conflicting provenance
 *
 * Source A claims hasAC=true; Source B claims hasAC=false.
 * After recording both values via `recordFieldConflict`, a FieldConflict row
 * with status=OPEN must exist for that dorm+field pair.
 *
 * Secondary assertions:
 *  - Calling recordFieldConflict with the same (value, sourceId) twice is
 *    idempotent — the conflict is not duplicated.
 *  - Resolving the conflict transitions status to RESOLVED.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, FieldConflictStatus, SourceType } from "@prisma/client";
import {
  seedIntegrationFixtures,
  cleanupIntegrationFixtures,
  type IntegrationFixtures,
} from "../../src/integration/fixtures.js";
import { recordFieldConflict } from "../../src/integration/helpers.js";

const prisma = new PrismaClient();
let fixtures: IntegrationFixtures;

beforeAll(async () => {
  fixtures = await seedIntegrationFixtures(prisma);
});

afterAll(async () => {
  await cleanupIntegrationFixtures(prisma);
  await prisma.$disconnect();
});

describe("conflicting provenance", () => {
  test("AC true vs AC false → FieldConflict OPEN", async () => {
    const { unit1 } = fixtures.dorms;
    const { berkeley } = fixtures.colleges;

    const srcA = await prisma.source.create({
      data: {
        url: "https://housing.berkeley-fixture.test/unit1/ac-true",
        canonicalUrl: "https://housing.berkeley-fixture.test/unit1/ac-true",
        collegeId: berkeley.id,
        sourceType: SourceType.OFFICIAL_WEBSITE,
        confidence: 0.9,
      },
    });

    const srcB = await prisma.source.create({
      data: {
        url: "https://housing.berkeley-fixture.test/unit1/ac-false",
        canonicalUrl: "https://housing.berkeley-fixture.test/unit1/ac-false",
        collegeId: berkeley.id,
        sourceType: SourceType.OFFICIAL_WEBSITE,
        confidence: 0.8,
      },
    });

    await recordFieldConflict(prisma, {
      dormId: unit1.id,
      fieldName: "hasAC",
      value: true,
      sourceId: srcA.id,
      sourceUrl: srcA.url,
      confidence: 0.9,
    });

    await recordFieldConflict(prisma, {
      dormId: unit1.id,
      fieldName: "hasAC",
      value: false,
      sourceId: srcB.id,
      sourceUrl: srcB.url,
      confidence: 0.8,
    });

    const conflict = await prisma.fieldConflict.findFirst({
      where: { dormId: unit1.id, fieldName: "hasAC", status: FieldConflictStatus.OPEN },
    });

    expect(conflict).not.toBeNull();
    expect(conflict!.status).toBe(FieldConflictStatus.OPEN);

    const values = conflict!.values as Array<{ value: unknown; sourceId: string }>;
    expect(values).toHaveLength(2);
    expect(values.map((v) => v.value)).toContain(true);
    expect(values.map((v) => v.value)).toContain(false);

    // Cleanup
    await prisma.fieldConflict.deleteMany({ where: { dormId: unit1.id, fieldName: "hasAC" } });
    await prisma.source.deleteMany({ where: { id: { in: [srcA.id, srcB.id] } } });
  });

  test("recording same (value, sourceId) twice is idempotent", async () => {
    const { unit2 } = fixtures.dorms;
    const { berkeley } = fixtures.colleges;

    const src = await prisma.source.create({
      data: {
        url: "https://housing.berkeley-fixture.test/unit2/idempotent-conflict",
        canonicalUrl: "https://housing.berkeley-fixture.test/unit2/idempotent-conflict",
        collegeId: berkeley.id,
        sourceType: SourceType.OFFICIAL_WEBSITE,
        confidence: 0.8,
      },
    });

    await recordFieldConflict(prisma, {
      dormId: unit2.id,
      fieldName: "bathroomStyle",
      value: "COMMUNAL",
      sourceId: src.id,
    });

    await recordFieldConflict(prisma, {
      dormId: unit2.id,
      fieldName: "bathroomStyle",
      value: "COMMUNAL",
      sourceId: src.id,
    });

    const conflicts = await prisma.fieldConflict.findMany({
      where: { dormId: unit2.id, fieldName: "bathroomStyle" },
    });

    // One conflict row
    expect(conflicts).toHaveLength(1);
    // Only one value entry (idempotent)
    const vals = conflicts[0].values as unknown[];
    expect(vals).toHaveLength(1);

    // Cleanup
    await prisma.fieldConflict.deleteMany({ where: { dormId: unit2.id, fieldName: "bathroomStyle" } });
    await prisma.source.delete({ where: { id: src.id } });
  });

  test("resolving a conflict transitions status to RESOLVED", async () => {
    const { unit1 } = fixtures.dorms;
    const { berkeley } = fixtures.colleges;

    const srcA = await prisma.source.create({
      data: {
        url: "https://housing.berkeley-fixture.test/unit1/resolve-a",
        canonicalUrl: "https://housing.berkeley-fixture.test/unit1/resolve-a",
        collegeId: berkeley.id,
        sourceType: SourceType.OFFICIAL_WEBSITE,
        confidence: 0.9,
      },
    });

    const srcB = await prisma.source.create({
      data: {
        url: "https://housing.berkeley-fixture.test/unit1/resolve-b",
        canonicalUrl: "https://housing.berkeley-fixture.test/unit1/resolve-b",
        collegeId: berkeley.id,
        sourceType: SourceType.OFFICIAL_WEBSITE,
        confidence: 0.6,
      },
    });

    await recordFieldConflict(prisma, {
      dormId: unit1.id,
      fieldName: "kitchenAccess",
      value: true,
      sourceId: srcA.id,
    });

    await recordFieldConflict(prisma, {
      dormId: unit1.id,
      fieldName: "kitchenAccess",
      value: false,
      sourceId: srcB.id,
    });

    const conflict = await prisma.fieldConflict.findFirstOrThrow({
      where: { dormId: unit1.id, fieldName: "kitchenAccess", status: FieldConflictStatus.OPEN },
    });

    // Resolve it
    await prisma.fieldConflict.update({
      where: { id: conflict.id },
      data: { status: FieldConflictStatus.RESOLVED },
    });

    const resolved = await prisma.fieldConflict.findUnique({ where: { id: conflict.id } });
    expect(resolved!.status).toBe(FieldConflictStatus.RESOLVED);

    // Cleanup
    await prisma.fieldConflict.deleteMany({ where: { dormId: unit1.id, fieldName: "kitchenAccess" } });
    await prisma.source.deleteMany({ where: { id: { in: [srcA.id, srcB.id] } } });
  });
});
