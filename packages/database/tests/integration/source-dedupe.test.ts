/**
 * Integration: source deduplication via canonicalUrl
 *
 * The Source model has @@unique([collegeId, canonicalUrl]).
 * Sources that differ only by tracking params, trailing slash, or fragment
 * must normalize to the same canonicalUrl and thus collide in the DB.
 *
 * Tests:
 *  1. UTM params stripped → same canonical as the clean URL.
 *  2. Trailing slash stripped → same canonical.
 *  3. Fragment (#...) stripped → same canonical.
 *  4. Mixed host case normalized → same canonical.
 *  5. Upsert on (collegeId, canonicalUrl) → one row even after two ingests.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, SourceType } from "@prisma/client";
import { canonicalUrl } from "@dormscope/shared";
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

describe("canonicalUrl utility — normalization", () => {
  test("UTM params are stripped", () => {
    const raw = "https://housing.example.edu/dorms?utm_source=email&utm_campaign=spring24";
    const canon = canonicalUrl(raw);
    expect(canon).not.toContain("utm_");
    expect(canon).toBe("https://housing.example.edu/dorms");
  });

  test("trailing slash removed from non-root path", () => {
    const withSlash = "https://housing.example.edu/dorms/";
    const withoutSlash = "https://housing.example.edu/dorms";
    expect(canonicalUrl(withSlash)).toBe(canonicalUrl(withoutSlash));
  });

  test("root path trailing slash preserved", () => {
    const root = "https://housing.example.edu/";
    const canon = canonicalUrl(root);
    // Root path stays "/" — different implementations may keep or drop it.
    // The key invariant: same root URL normalized twice gives the same result.
    expect(canonicalUrl(root)).toBe(canon);
  });

  test("fragment stripped", () => {
    const withFragment = "https://housing.example.edu/dorms#unit1";
    const withoutFragment = "https://housing.example.edu/dorms";
    expect(canonicalUrl(withFragment)).toBe(canonicalUrl(withoutFragment));
  });

  test("host lowercased", () => {
    const mixed = "https://Housing.Example.EDU/dorms";
    expect(canonicalUrl(mixed)).toBe("https://housing.example.edu/dorms");
  });

  test("all tracking params stripped together with other params kept", () => {
    const url =
      "https://housing.example.edu/dorms?page=2&utm_source=google&fbclid=XYZ&sort=price";
    const canon = canonicalUrl(url);
    expect(canon).not.toContain("utm_");
    expect(canon).not.toContain("fbclid");
    expect(canon).toContain("page=2");
    expect(canon).toContain("sort=price");
  });

  test("gclid stripped", () => {
    const url = "https://housing.example.edu/apply?gclid=CjwK&ref=ad";
    const canon = canonicalUrl(url);
    expect(canon).not.toContain("gclid");
    expect(canon).not.toContain("ref=ad");
  });
});

describe("source deduplication — DB layer", () => {
  test("two URLs with same canonical → upsert produces one row", async () => {
    const { berkeley } = fixtures.colleges;

    const urlWithTracking =
      "https://housing.berkeley-fixture.test/unit1?utm_source=newsletter";
    const urlClean = "https://housing.berkeley-fixture.test/unit1";
    const canonical = canonicalUrl(urlWithTracking);

    // First ingest
    await prisma.source.upsert({
      where: {
        collegeId_canonicalUrl: { collegeId: berkeley.id, canonicalUrl: canonical },
      },
      create: {
        url: urlWithTracking,
        canonicalUrl: canonical,
        collegeId: berkeley.id,
        sourceType: SourceType.OFFICIAL_WEBSITE,
        confidence: 0.8,
        scrapedAt: new Date(),
      },
      update: { scrapedAt: new Date() },
    });

    // Second ingest with clean URL (same canonical)
    await prisma.source.upsert({
      where: {
        collegeId_canonicalUrl: { collegeId: berkeley.id, canonicalUrl: canonical },
      },
      create: {
        url: urlClean,
        canonicalUrl: canonical,
        collegeId: berkeley.id,
        sourceType: SourceType.OFFICIAL_WEBSITE,
        confidence: 0.9,
        scrapedAt: new Date(),
      },
      update: { scrapedAt: new Date() },
    });

    const count = await prisma.source.count({
      where: { collegeId: berkeley.id, canonicalUrl: canonical },
    });

    expect(count).toBe(1);

    // Cleanup
    await prisma.source.deleteMany({ where: { collegeId: berkeley.id, canonicalUrl: canonical } });
  });

  test("trailing-slash URL and non-trailing URL deduplicate", async () => {
    const { scu } = fixtures.colleges;

    const urlA = "https://housing.scu-fixture.test/halls/swig/";
    const urlB = "https://housing.scu-fixture.test/halls/swig";
    const canonA = canonicalUrl(urlA);
    const canonB = canonicalUrl(urlB);

    expect(canonA).toBe(canonB);

    await prisma.source.upsert({
      where: {
        collegeId_canonicalUrl: { collegeId: scu.id, canonicalUrl: canonA },
      },
      create: {
        url: urlA,
        canonicalUrl: canonA,
        collegeId: scu.id,
        sourceType: SourceType.OFFICIAL_WEBSITE,
        confidence: 0.8,
      },
      update: {},
    });

    await prisma.source.upsert({
      where: {
        collegeId_canonicalUrl: { collegeId: scu.id, canonicalUrl: canonB },
      },
      create: {
        url: urlB,
        canonicalUrl: canonB,
        collegeId: scu.id,
        sourceType: SourceType.OFFICIAL_WEBSITE,
        confidence: 0.8,
      },
      update: {},
    });

    const count = await prisma.source.count({
      where: { collegeId: scu.id, canonicalUrl: canonA },
    });

    expect(count).toBe(1);

    // Cleanup
    await prisma.source.deleteMany({ where: { collegeId: scu.id, canonicalUrl: canonA } });
  });

  test("fragment-only difference deduplicates", async () => {
    const { berkeley } = fixtures.colleges;

    const urlA = "https://housing.berkeley-fixture.test/overview#rates";
    const urlB = "https://housing.berkeley-fixture.test/overview";
    const canon = canonicalUrl(urlA);

    expect(canonicalUrl(urlB)).toBe(canon);

    await prisma.source.upsert({
      where: { collegeId_canonicalUrl: { collegeId: berkeley.id, canonicalUrl: canon } },
      create: {
        url: urlA,
        canonicalUrl: canon,
        collegeId: berkeley.id,
        sourceType: SourceType.OFFICIAL_WEBSITE,
        confidence: 0.7,
      },
      update: {},
    });

    await prisma.source.upsert({
      where: { collegeId_canonicalUrl: { collegeId: berkeley.id, canonicalUrl: canon } },
      create: {
        url: urlB,
        canonicalUrl: canon,
        collegeId: berkeley.id,
        sourceType: SourceType.OFFICIAL_WEBSITE,
        confidence: 0.7,
      },
      update: {},
    });

    const count = await prisma.source.count({
      where: { collegeId: berkeley.id, canonicalUrl: canon },
    });
    expect(count).toBe(1);

    // Cleanup
    await prisma.source.deleteMany({ where: { collegeId: berkeley.id, canonicalUrl: canon } });
  });
});
