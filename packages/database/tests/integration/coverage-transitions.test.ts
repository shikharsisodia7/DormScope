/**
 * Integration: coverage transitions
 *
 * Verifies that:
 *  1. All HousingCoverageStatus enum values round-trip through the DB.
 *  2. Coverage status transitions are persisted correctly.
 *  3. Fixture colleges have the expected statuses.
 *
 * The `decideHousingCoverage` business logic is unit-tested separately in
 * packages/scraper — this test focuses on the DB schema layer.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, HousingCoverageStatus } from "@prisma/client";
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

/** All valid coverage statuses that should round-trip through the DB. */
const ALL_STATUSES = [
  HousingCoverageStatus.UNKNOWN,
  HousingCoverageStatus.NO_HOUSING,
  HousingCoverageStatus.DISCOVERY_PENDING,
  HousingCoverageStatus.SITE_FOUND,
  HousingCoverageStatus.DIRECTORY_PENDING,
  HousingCoverageStatus.PARTIAL,
  HousingCoverageStatus.COMPLETE,
  HousingCoverageStatus.BLOCKED,
  HousingCoverageStatus.FAILED,
  HousingCoverageStatus.RETRYABLE,
] as const;

describe("coverage status — enum round-trip", () => {
  test("all HousingCoverageStatus values can be written and read back", async () => {
    const { stanford } = fixtures.colleges;

    for (const status of ALL_STATUSES) {
      await prisma.college.update({
        where: { id: stanford.id },
        data: { housingCoverageStatus: status },
      });

      const { housingCoverageStatus } = await prisma.college.findUniqueOrThrow({
        where: { id: stanford.id },
        select: { housingCoverageStatus: true },
      });

      expect(housingCoverageStatus).toBe(status);
    }

    // Restore to fixture default
    await prisma.college.update({
      where: { id: stanford.id },
      data: { housingCoverageStatus: HousingCoverageStatus.PARTIAL },
    });
  });
});

describe("coverage status — fixture assertions", () => {
  test("berkeley-fixture → COMPLETE", async () => {
    const { berkeley } = fixtures.colleges;
    const c = await prisma.college.findUniqueOrThrow({
      where: { id: berkeley.id },
      select: { housingCoverageStatus: true },
    });
    expect(c.housingCoverageStatus).toBe(HousingCoverageStatus.COMPLETE);
  });

  test("zero-inventory-fixture → DISCOVERY_PENDING", async () => {
    const { zeroInventory } = fixtures.colleges;
    const c = await prisma.college.findUniqueOrThrow({
      where: { id: zeroInventory.id },
      select: { housingCoverageStatus: true },
    });
    expect(c.housingCoverageStatus).toBe(HousingCoverageStatus.DISCOVERY_PENDING);
  });

  test("blocked-fixture → BLOCKED", async () => {
    const { blocked } = fixtures.colleges;
    const c = await prisma.college.findUniqueOrThrow({
      where: { id: blocked.id },
      select: { housingCoverageStatus: true },
    });
    expect(c.housingCoverageStatus).toBe(HousingCoverageStatus.BLOCKED);
  });

  test("scu-fixture → COMPLETE", async () => {
    const { scu } = fixtures.colleges;
    const c = await prisma.college.findUniqueOrThrow({
      where: { id: scu.id },
      select: { housingCoverageStatus: true },
    });
    expect(c.housingCoverageStatus).toBe(HousingCoverageStatus.COMPLETE);
  });
});

describe("coverage status — transitions", () => {
  test("PARTIAL → COMPLETE → PARTIAL round trip", async () => {
    const { ucla } = fixtures.colleges;

    await prisma.college.update({
      where: { id: ucla.id },
      data: { housingCoverageStatus: HousingCoverageStatus.COMPLETE },
    });

    const after = await prisma.college.findUniqueOrThrow({
      where: { id: ucla.id },
      select: { housingCoverageStatus: true },
    });
    expect(after.housingCoverageStatus).toBe(HousingCoverageStatus.COMPLETE);

    await prisma.college.update({
      where: { id: ucla.id },
      data: { housingCoverageStatus: HousingCoverageStatus.PARTIAL },
    });
  });

  test("BLOCKED college can be unblocked to RETRYABLE", async () => {
    const { blocked } = fixtures.colleges;

    await prisma.college.update({
      where: { id: blocked.id },
      data: { housingCoverageStatus: HousingCoverageStatus.RETRYABLE },
    });

    const unblocked = await prisma.college.findUniqueOrThrow({
      where: { id: blocked.id },
      select: { housingCoverageStatus: true },
    });
    expect(unblocked.housingCoverageStatus).toBe(HousingCoverageStatus.RETRYABLE);

    // Restore
    await prisma.college.update({
      where: { id: blocked.id },
      data: { housingCoverageStatus: HousingCoverageStatus.BLOCKED },
    });
  });

  test("DISCOVERY_PENDING → SITE_FOUND → DIRECTORY_PENDING → PARTIAL chain", async () => {
    const { zeroInventory } = fixtures.colleges;

    const transitions = [
      HousingCoverageStatus.SITE_FOUND,
      HousingCoverageStatus.DIRECTORY_PENDING,
      HousingCoverageStatus.PARTIAL,
    ];

    for (const status of transitions) {
      await prisma.college.update({
        where: { id: zeroInventory.id },
        data: { housingCoverageStatus: status },
      });
      const c = await prisma.college.findUniqueOrThrow({
        where: { id: zeroInventory.id },
        select: { housingCoverageStatus: true },
      });
      expect(c.housingCoverageStatus).toBe(status);
    }

    // Restore
    await prisma.college.update({
      where: { id: zeroInventory.id },
      data: { housingCoverageStatus: HousingCoverageStatus.DISCOVERY_PENDING },
    });
  });
});

describe("coverage status — filtering", () => {
  test("colleges with BLOCKED status are queryable by status", async () => {
    const blockedColleges = await prisma.college.findMany({
      where: {
        housingCoverageStatus: HousingCoverageStatus.BLOCKED,
        slug: { in: ["blocked-fixture"] },
      },
      select: { slug: true },
    });
    expect(blockedColleges.map((c) => c.slug)).toContain("blocked-fixture");
  });

  test("colleges with DISCOVERY_PENDING status are queryable", async () => {
    const pending = await prisma.college.findMany({
      where: {
        housingCoverageStatus: HousingCoverageStatus.DISCOVERY_PENDING,
        slug: { in: ["zero-inventory-fixture"] },
      },
    });
    expect(pending).toHaveLength(1);
  });
});
