/**
 * Integration: ingest idempotency
 *
 * Verifies that ingesting the same housing entity twice (via slug-based upsert)
 * produces exactly one Dorm row, one DormSource link, and one DormScore — not
 * duplicates.  This mirrors the production behavior of persistExtractedDorm.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, SourceType, HousingEntityKind } from "@prisma/client";
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

describe("ingest idempotency", () => {
  test("same entity ingested twice → exactly one Dorm row", async () => {
    const { berkeley } = fixtures.colleges;
    const slug = "idempotency-test-dorm";

    // First ingest
    await prisma.dorm.upsert({
      where: { collegeId_slug: { collegeId: berkeley.id, slug } },
      create: {
        name: "Idempotency Test Dorm",
        slug,
        collegeId: berkeley.id,
        entityKind: HousingEntityKind.RESIDENCE,
        confidenceScore: 0.8,
        lastUpdatedAt: new Date(),
      },
      update: { lastUpdatedAt: new Date(), confidenceScore: 0.8 },
    });

    // Second ingest (same source, same data)
    await prisma.dorm.upsert({
      where: { collegeId_slug: { collegeId: berkeley.id, slug } },
      create: {
        name: "Idempotency Test Dorm",
        slug,
        collegeId: berkeley.id,
        entityKind: HousingEntityKind.RESIDENCE,
        confidenceScore: 0.8,
        lastUpdatedAt: new Date(),
      },
      update: { lastUpdatedAt: new Date(), confidenceScore: 0.85 },
    });

    const count = await prisma.dorm.count({
      where: { collegeId: berkeley.id, slug },
    });
    expect(count).toBe(1);

    // Cleanup
    await prisma.dorm.deleteMany({ where: { collegeId: berkeley.id, slug } });
  });

  test("DormSource upsert is idempotent — same source linked twice → one row", async () => {
    const { unit1 } = fixtures.dorms;
    const { berkeleySource } = fixtures.sources;

    // DormSource for unit1 ↔ berkeleySource already created by the fixture.
    // Try linking again (simulate re-ingest).
    await prisma.dormSource.upsert({
      where: {
        dormId_sourceId: { dormId: unit1.id, sourceId: berkeleySource.id },
      },
      create: { dormId: unit1.id, sourceId: berkeleySource.id, role: "directory" },
      update: {},
    });

    const count = await prisma.dormSource.count({
      where: { dormId: unit1.id, sourceId: berkeleySource.id },
    });
    expect(count).toBe(1);
  });

  test("DormScore upsert is idempotent — scored twice → one row", async () => {
    const { unit1 } = fixtures.dorms;

    await prisma.dormScore.upsert({
      where: { dormId: unit1.id },
      create: { dormId: unit1.id, overallScore: 72, scoreable: true },
      update: { overallScore: 75, calculatedAt: new Date() },
    });

    await prisma.dormScore.upsert({
      where: { dormId: unit1.id },
      create: { dormId: unit1.id, overallScore: 72, scoreable: true },
      update: { overallScore: 78, calculatedAt: new Date() },
    });

    const scores = await prisma.dormScore.findMany({ where: { dormId: unit1.id } });
    expect(scores).toHaveLength(1);
    expect(scores[0].overallScore).toBe(78); // last update wins
  });

  test("Source upsert deduplicated on canonicalUrl", async () => {
    const { berkeley } = fixtures.colleges;
    const canonicalUrl = "https://housing.berkeley-fixture.test/rooms";

    const s1 = await prisma.source.create({
      data: {
        url: "https://housing.berkeley-fixture.test/rooms?utm_source=email",
        canonicalUrl,
        collegeId: berkeley.id,
        sourceType: SourceType.OFFICIAL_WEBSITE,
        confidence: 0.8,
      },
    });

    // Second ingest: same canonical → upsert, not duplicate
    const s2 = await prisma.source.upsert({
      where: { collegeId_canonicalUrl: { collegeId: berkeley.id, canonicalUrl } },
      create: {
        url: canonicalUrl,
        canonicalUrl,
        collegeId: berkeley.id,
        sourceType: SourceType.OFFICIAL_WEBSITE,
        confidence: 0.8,
      },
      update: { scrapedAt: new Date() },
    });

    expect(s1.id).toBe(s2.id);

    const cnt = await prisma.source.count({
      where: { collegeId: berkeley.id, canonicalUrl },
    });
    expect(cnt).toBe(1);

    // Cleanup
    await prisma.source.delete({ where: { id: s1.id } });
  });
});
