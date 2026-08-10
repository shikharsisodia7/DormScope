/**
 * Integration: duplicate merge
 *
 * Merging mergeDuplicate → mergePrimary must:
 *  - Migrate all reviews from the duplicate to the primary.
 *  - Migrate all DormSource links (deduplicating if the same source is already
 *    linked to the primary).
 *  - Migrate FavoriteDorm entries (deduplicating on userId).
 *  - Mark the duplicate with dataQualityStatus=DUPLICATE and duplicateOfId
 *    pointing to the primary.
 *  - Leave the primary's own data intact.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, DataQualityStatus, SourceType } from "@prisma/client";
import {
  seedIntegrationFixtures,
  cleanupIntegrationFixtures,
  type IntegrationFixtures,
} from "../../src/integration/fixtures.js";
import { mergeDorms } from "../../src/integration/helpers.js";

const prisma = new PrismaClient();
let fixtures: IntegrationFixtures;

beforeAll(async () => {
  fixtures = await seedIntegrationFixtures(prisma);
});

afterAll(async () => {
  await cleanupIntegrationFixtures(prisma);
  await prisma.$disconnect();
});

describe("duplicate merge", () => {
  test("reviews migrate from duplicate to primary", async () => {
    const { mergePrimary, mergeDuplicate } = fixtures.dorms;
    const { testUser } = fixtures.users;

    // Add a review to the duplicate
    const review = await prisma.review.create({
      data: {
        dormId: mergeDuplicate.id,
        userId: testUser.id,
        overallRating: 3.5,
        pros: "Nice location",
      },
    });

    const result = await mergeDorms(prisma, {
      targetId: mergePrimary.id,
      sourceId: mergeDuplicate.id,
    });

    expect(result.migratedReviews).toBe(1);

    // Review now belongs to primary
    const movedReview = await prisma.review.findUnique({ where: { id: review.id } });
    expect(movedReview?.dormId).toBe(mergePrimary.id);

    // Duplicate dorm marked as DUPLICATE
    const dup = await prisma.dorm.findUnique({ where: { id: mergeDuplicate.id } });
    expect(dup?.dataQualityStatus).toBe(DataQualityStatus.DUPLICATE);
    expect(dup?.duplicateOfId).toBe(mergePrimary.id);
    expect(dup?.isActive).toBe(false);

    // Re-seed for subsequent tests
    fixtures = await seedIntegrationFixtures(prisma);
  });

  test("DormSource links migrate; existing links on primary are not duplicated", async () => {
    const { mergePrimary, mergeDuplicate } = fixtures.dorms;
    const { ucla } = fixtures.colleges;

    // Create a source that will be linked to the duplicate
    const sharedSrc = await prisma.source.create({
      data: {
        url: "https://housing.ucla-fixture.test/shared-src",
        canonicalUrl: "https://housing.ucla-fixture.test/shared-src",
        collegeId: ucla.id,
        sourceType: SourceType.OFFICIAL_WEBSITE,
        confidence: 0.8,
      },
    });

    const exclusiveSrc = await prisma.source.create({
      data: {
        url: "https://housing.ucla-fixture.test/dup-only-src",
        canonicalUrl: "https://housing.ucla-fixture.test/dup-only-src",
        collegeId: ucla.id,
        sourceType: SourceType.OFFICIAL_WEBSITE,
        confidence: 0.7,
      },
    });

    // Link sharedSrc to BOTH primary and duplicate (simulate pre-existing overlap)
    await prisma.dormSource.upsert({
      where: { dormId_sourceId: { dormId: mergePrimary.id, sourceId: sharedSrc.id } },
      create: { dormId: mergePrimary.id, sourceId: sharedSrc.id, role: "directory" },
      update: {},
    });

    await prisma.dormSource.upsert({
      where: { dormId_sourceId: { dormId: mergeDuplicate.id, sourceId: sharedSrc.id } },
      create: { dormId: mergeDuplicate.id, sourceId: sharedSrc.id, role: "directory" },
      update: {},
    });

    // Link exclusiveSrc only to duplicate
    await prisma.dormSource.upsert({
      where: { dormId_sourceId: { dormId: mergeDuplicate.id, sourceId: exclusiveSrc.id } },
      create: { dormId: mergeDuplicate.id, sourceId: exclusiveSrc.id, role: "detail" },
      update: {},
    });

    const result = await mergeDorms(prisma, {
      targetId: mergePrimary.id,
      sourceId: mergeDuplicate.id,
    });

    expect(result.migratedSources).toBeGreaterThanOrEqual(1);

    // Primary now has both sources linked (no duplicates)
    const primaryLinks = await prisma.dormSource.findMany({
      where: { dormId: mergePrimary.id },
    });
    const linkedSourceIds = primaryLinks.map((l) => l.sourceId);
    expect(linkedSourceIds).toContain(sharedSrc.id);
    expect(linkedSourceIds).toContain(exclusiveSrc.id);

    // Unique: sharedSrc appears only once
    const sharedCount = linkedSourceIds.filter((id) => id === sharedSrc.id).length;
    expect(sharedCount).toBe(1);

    // Cleanup extra sources
    await prisma.dormSource.deleteMany({
      where: { dormId: mergePrimary.id, sourceId: { in: [sharedSrc.id, exclusiveSrc.id] } },
    });
    await prisma.source.deleteMany({ where: { id: { in: [sharedSrc.id, exclusiveSrc.id] } } });

    // Re-seed for subsequent tests
    fixtures = await seedIntegrationFixtures(prisma);
  });

  test("FavoriteDorm entries migrate; duplicate user favorites on primary deduplicated", async () => {
    const { mergePrimary, mergeDuplicate } = fixtures.dorms;
    const { testUser } = fixtures.users;

    // User already has a favorite on the duplicate (from fixture seed)
    // In case it wasn't created, create it now
    await prisma.favoriteDorm.upsert({
      where: { userId_dormId: { userId: testUser.id, dormId: mergeDuplicate.id } },
      create: { userId: testUser.id, dormId: mergeDuplicate.id, notes: "Dup fav" },
      update: {},
    });

    const result = await mergeDorms(prisma, {
      targetId: mergePrimary.id,
      sourceId: mergeDuplicate.id,
    });

    expect(result.migratedFavorites).toBeGreaterThanOrEqual(1);

    // User's favorite now points to primary
    const primaryFav = await prisma.favoriteDorm.findUnique({
      where: { userId_dormId: { userId: testUser.id, dormId: mergePrimary.id } },
    });
    expect(primaryFav).not.toBeNull();

    // No orphaned favorite on the duplicate
    const dupFav = await prisma.favoriteDorm.findUnique({
      where: { userId_dormId: { userId: testUser.id, dormId: mergeDuplicate.id } },
    });
    expect(dupFav).toBeNull();

    // Cleanup
    await prisma.favoriteDorm.deleteMany({ where: { dormId: mergePrimary.id } });

    // Re-seed for subsequent tests
    fixtures = await seedIntegrationFixtures(prisma);
  });
});
