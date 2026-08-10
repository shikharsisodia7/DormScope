/**
 * Integration: quarantine safety
 *
 * Quarantining a dorm that has reviews and favorites must NOT delete those
 * child relations — it only flips dataQualityStatus and sets quarantineReason.
 * Restoring (setting status back to ACTIVE) must also preserve them.
 *
 * This verifies the schema's intentional design: quarantine is a soft state
 * transition, not a cascade delete.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, DataQualityStatus } from "@prisma/client";
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

describe("quarantine safety", () => {
  test("quarantining a dorm preserves its reviews and favorites", async () => {
    const { quarantineTarget } = fixtures.dorms;
    const { testUser } = fixtures.users;

    // Verify fixtures created the review and favorite
    const reviewsBefore = await prisma.review.count({ where: { dormId: quarantineTarget.id } });
    const favoritesBefore = await prisma.favoriteDorm.count({
      where: { dormId: quarantineTarget.id },
    });

    expect(reviewsBefore).toBeGreaterThan(0);
    expect(favoritesBefore).toBeGreaterThan(0);

    // Quarantine (soft state transition)
    await prisma.dorm.update({
      where: { id: quarantineTarget.id },
      data: {
        dataQualityStatus: DataQualityStatus.QUARANTINED,
        quarantineReason: "Automated junk detection",
        quarantinedAt: new Date(),
        quarantinedBy: "integration-test",
      },
    });

    const dorm = await prisma.dorm.findUniqueOrThrow({ where: { id: quarantineTarget.id } });
    expect(dorm.dataQualityStatus).toBe(DataQualityStatus.QUARANTINED);

    // Reviews and favorites must still exist — quarantine is NOT a delete
    const reviewsAfter = await prisma.review.count({ where: { dormId: quarantineTarget.id } });
    const favoritesAfter = await prisma.favoriteDorm.count({
      where: { dormId: quarantineTarget.id },
    });

    expect(reviewsAfter).toBe(reviewsBefore);
    expect(favoritesAfter).toBe(favoritesBefore);
  });

  test("restoring a quarantined dorm preserves its reviews and favorites", async () => {
    const { quarantineTarget } = fixtures.dorms;

    // Restore to ACTIVE
    await prisma.dorm.update({
      where: { id: quarantineTarget.id },
      data: {
        dataQualityStatus: DataQualityStatus.ACTIVE,
        quarantineReason: null,
        quarantinedAt: null,
        quarantinedBy: null,
      },
    });

    const dorm = await prisma.dorm.findUniqueOrThrow({ where: { id: quarantineTarget.id } });
    expect(dorm.dataQualityStatus).toBe(DataQualityStatus.ACTIVE);

    // Relations still intact after restore
    const reviewCount = await prisma.review.count({ where: { dormId: quarantineTarget.id } });
    const favoriteCount = await prisma.favoriteDorm.count({
      where: { dormId: quarantineTarget.id },
    });

    expect(reviewCount).toBeGreaterThan(0);
    expect(favoriteCount).toBeGreaterThan(0);
  });

  test("quarantining a dorm does not affect other dorms at the same college", async () => {
    const { quarantineTarget, unit1, unit2 } = fixtures.dorms;

    await prisma.dorm.update({
      where: { id: quarantineTarget.id },
      data: { dataQualityStatus: DataQualityStatus.QUARANTINED },
    });

    const unit1Status = await prisma.dorm.findUniqueOrThrow({
      where: { id: unit1.id },
      select: { dataQualityStatus: true },
    });
    const unit2Status = await prisma.dorm.findUniqueOrThrow({
      where: { id: unit2.id },
      select: { dataQualityStatus: true },
    });

    expect(unit1Status.dataQualityStatus).toBe(DataQualityStatus.ACTIVE);
    expect(unit2Status.dataQualityStatus).toBe(DataQualityStatus.ACTIVE);

    // Restore for subsequent tests
    await prisma.dorm.update({
      where: { id: quarantineTarget.id },
      data: { dataQualityStatus: DataQualityStatus.ACTIVE },
    });
  });
});
