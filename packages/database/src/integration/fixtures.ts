/**
 * Integration test fixtures for DormScope.
 *
 * Call `seedIntegrationFixtures(prisma)` in test `beforeAll` blocks.
 * The function is idempotent: it deletes any previous fixture data before
 * re-seeding so successive runs stay clean.
 */
import type { PrismaClient, College, Dorm, User, Source } from "@prisma/client";
import {
  HousingCoverageStatus,
  DataQualityStatus,
  HousingEntityKind,
  SourceType,
  UserRole,
} from "@prisma/client";

/** Stable slug identifiers used by all fixture colleges. */
export const FIXTURE_COLLEGE_SLUGS = [
  "berkeley-fixture",
  "ucla-fixture",
  "scu-fixture",
  "stanford-fixture",
  "zero-inventory-fixture",
  "blocked-fixture",
  "hierarchy-fixture",
] as const;

export type FixtureCollegeSlug = (typeof FIXTURE_COLLEGE_SLUGS)[number];

export interface IntegrationFixtures {
  colleges: {
    berkeley: College;
    ucla: College;
    scu: College;
    stanford: College;
    zeroInventory: College;
    blocked: College;
    hierarchy: College;
  };
  dorms: {
    /** berkeley-fixture — standard residence hall */
    unit1: Dorm;
    /** berkeley-fixture — second residence hall */
    unit2: Dorm;
    /** scu-fixture — residence hall */
    swigHall: Dorm;
    /** hierarchy-fixture — non-assignable VILLAGE container */
    parentVillage: Dorm;
    /** hierarchy-fixture — assignable BUILDING child of parentVillage */
    buildingA: Dorm;
    /** hierarchy-fixture — assignable BUILDING child of parentVillage */
    buildingB: Dorm;
    /** berkeley-fixture — dorm used in quarantine safety tests (has review + favorite) */
    quarantineTarget: Dorm;
    /** ucla-fixture — primary dorm in duplicate merge test */
    mergePrimary: Dorm;
    /** ucla-fixture — duplicate dorm to merge into mergePrimary */
    mergeDuplicate: Dorm;
  };
  sources: {
    berkeleySource: Source;
    scuSource: Source;
  };
  users: {
    testUser: User;
  };
}

/** Remove all fixture colleges (cascades to dorms, sources, etc.). */
export async function cleanupIntegrationFixtures(prisma: PrismaClient): Promise<void> {
  await prisma.college.deleteMany({
    where: { slug: { in: [...FIXTURE_COLLEGE_SLUGS] } },
  });
  await prisma.user.deleteMany({
    where: { email: "fixture-test-user@dormscope-integration.test" },
  });
}

/**
 * Create (or recreate) all integration test fixtures.
 * Safe to call multiple times — cleans up first.
 */
export async function seedIntegrationFixtures(
  prisma: PrismaClient
): Promise<IntegrationFixtures> {
  await cleanupIntegrationFixtures(prisma);

  // ── Colleges ────────────────────────────────────────────────────────────
  const berkeley = await prisma.college.create({
    data: {
      name: "UC Berkeley (Fixture)",
      slug: "berkeley-fixture",
      city: "Berkeley",
      state: "CA",
      housingCoverageStatus: HousingCoverageStatus.COMPLETE,
      hasResidentialHousing: true,
    },
  });

  const ucla = await prisma.college.create({
    data: {
      name: "UCLA (Fixture)",
      slug: "ucla-fixture",
      city: "Los Angeles",
      state: "CA",
      housingCoverageStatus: HousingCoverageStatus.PARTIAL,
      hasResidentialHousing: true,
    },
  });

  const scu = await prisma.college.create({
    data: {
      name: "Santa Clara University (Fixture)",
      slug: "scu-fixture",
      city: "Santa Clara",
      state: "CA",
      housingCoverageStatus: HousingCoverageStatus.COMPLETE,
      hasResidentialHousing: true,
    },
  });

  const stanford = await prisma.college.create({
    data: {
      name: "Stanford University (Fixture)",
      slug: "stanford-fixture",
      city: "Stanford",
      state: "CA",
      housingCoverageStatus: HousingCoverageStatus.PARTIAL,
      hasResidentialHousing: true,
    },
  });

  const zeroInventory = await prisma.college.create({
    data: {
      name: "Zero Inventory College (Fixture)",
      slug: "zero-inventory-fixture",
      city: "Testville",
      state: "CA",
      housingCoverageStatus: HousingCoverageStatus.DISCOVERY_PENDING,
      hasResidentialHousing: null,
    },
  });

  const blocked = await prisma.college.create({
    data: {
      name: "Blocked College (Fixture)",
      slug: "blocked-fixture",
      city: "Blocktown",
      state: "CA",
      housingCoverageStatus: HousingCoverageStatus.BLOCKED,
      hasResidentialHousing: null,
    },
  });

  const hierarchy = await prisma.college.create({
    data: {
      name: "Hierarchy College (Fixture)",
      slug: "hierarchy-fixture",
      city: "Hierarchyville",
      state: "CA",
      housingCoverageStatus: HousingCoverageStatus.COMPLETE,
      hasResidentialHousing: true,
    },
  });

  // ── Sources ─────────────────────────────────────────────────────────────
  const berkeleySource = await prisma.source.create({
    data: {
      url: "https://housing.berkeley-fixture.test/",
      canonicalUrl: "https://housing.berkeley-fixture.test/",
      collegeId: berkeley.id,
      sourceType: SourceType.OFFICIAL_WEBSITE,
      confidence: 0.9,
      isApproved: true,
    },
  });

  const scuSource = await prisma.source.create({
    data: {
      url: "https://housing.scu-fixture.test/",
      canonicalUrl: "https://housing.scu-fixture.test/",
      collegeId: scu.id,
      sourceType: SourceType.OFFICIAL_WEBSITE,
      confidence: 0.9,
      isApproved: true,
    },
  });

  // ── Berkeley Dorms ───────────────────────────────────────────────────────
  const unit1 = await prisma.dorm.create({
    data: {
      name: "Unit 1",
      slug: "unit-1",
      collegeId: berkeley.id,
      entityKind: HousingEntityKind.UNIT,
      isAssignableHousingOption: true,
      rankingGranularity: true,
      freshmanEligible: true,
      hasAC: false,
      dataQualityStatus: DataQualityStatus.ACTIVE,
    },
  });

  // Link Unit 1 to berkeley source
  await prisma.dormSource.create({
    data: { dormId: unit1.id, sourceId: berkeleySource.id, role: "directory" },
  });

  const unit2 = await prisma.dorm.create({
    data: {
      name: "Unit 2",
      slug: "unit-2",
      collegeId: berkeley.id,
      entityKind: HousingEntityKind.UNIT,
      isAssignableHousingOption: true,
      rankingGranularity: true,
      freshmanEligible: true,
      hasAC: false,
      dataQualityStatus: DataQualityStatus.ACTIVE,
    },
  });

  await prisma.dormSource.create({
    data: { dormId: unit2.id, sourceId: berkeleySource.id, role: "directory" },
  });

  // ── Quarantine test dorm (berkeley) — has a review and a favorite ────────
  const testUser = await prisma.user.create({
    data: {
      email: "fixture-test-user@dormscope-integration.test",
      name: "Integration Test User",
      role: UserRole.USER,
    },
  });

  const quarantineTarget = await prisma.dorm.create({
    data: {
      name: "Quarantine Test Dorm",
      slug: "quarantine-test-dorm",
      collegeId: berkeley.id,
      entityKind: HousingEntityKind.RESIDENCE,
      isAssignableHousingOption: true,
      dataQualityStatus: DataQualityStatus.ACTIVE,
    },
  });

  // Add review and favorite so we can verify they survive quarantine
  await prisma.review.create({
    data: {
      dormId: quarantineTarget.id,
      userId: testUser.id,
      overallRating: 4,
      pros: "Nice fixtures",
    },
  });

  await prisma.favoriteDorm.create({
    data: {
      dormId: quarantineTarget.id,
      userId: testUser.id,
    },
  });

  // ── SCU Dorms ────────────────────────────────────────────────────────────
  const swigHall = await prisma.dorm.create({
    data: {
      name: "Swig Hall",
      slug: "swig-hall",
      collegeId: scu.id,
      entityKind: HousingEntityKind.RESIDENCE,
      isAssignableHousingOption: true,
      rankingGranularity: true,
      freshmanEligible: true,
      dataQualityStatus: DataQualityStatus.ACTIVE,
    },
  });

  await prisma.dormSource.create({
    data: { dormId: swigHall.id, sourceId: scuSource.id, role: "directory" },
  });

  // ── UCLA Dorms (for duplicate merge test) ────────────────────────────────
  const mergePrimary = await prisma.dorm.create({
    data: {
      name: "Sproul Hall",
      slug: "sproul-hall-primary",
      collegeId: ucla.id,
      entityKind: HousingEntityKind.RESIDENCE,
      isAssignableHousingOption: true,
      dataQualityStatus: DataQualityStatus.ACTIVE,
    },
  });

  const mergeDuplicate = await prisma.dorm.create({
    data: {
      name: "Sproul Hall (Duplicate)",
      slug: "sproul-hall-duplicate",
      collegeId: ucla.id,
      entityKind: HousingEntityKind.RESIDENCE,
      isAssignableHousingOption: true,
      dataQualityStatus: DataQualityStatus.ACTIVE,
    },
  });

  // ── Hierarchy Dorms ──────────────────────────────────────────────────────
  const parentVillage = await prisma.dorm.create({
    data: {
      name: "Parent Village",
      slug: "parent-village",
      collegeId: hierarchy.id,
      entityKind: HousingEntityKind.VILLAGE,
      // Organizational container — not directly assignable
      isAssignableHousingOption: false,
      rankingGranularity: false,
      dataQualityStatus: DataQualityStatus.ACTIVE,
    },
  });

  const buildingA = await prisma.dorm.create({
    data: {
      name: "Building A",
      slug: "building-a",
      collegeId: hierarchy.id,
      entityKind: HousingEntityKind.BUILDING,
      parentHousingId: parentVillage.id,
      // Child building — assignable
      isAssignableHousingOption: true,
      rankingGranularity: true,
      dataQualityStatus: DataQualityStatus.ACTIVE,
    },
  });

  const buildingB = await prisma.dorm.create({
    data: {
      name: "Building B",
      slug: "building-b",
      collegeId: hierarchy.id,
      entityKind: HousingEntityKind.BUILDING,
      parentHousingId: parentVillage.id,
      isAssignableHousingOption: true,
      rankingGranularity: true,
      dataQualityStatus: DataQualityStatus.ACTIVE,
    },
  });

  return {
    colleges: { berkeley, ucla, scu, stanford, zeroInventory, blocked, hierarchy },
    dorms: {
      unit1,
      unit2,
      swigHall,
      parentVillage,
      buildingA,
      buildingB,
      quarantineTarget,
      mergePrimary,
      mergeDuplicate,
    },
    sources: { berkeleySource, scuSource },
    users: { testUser },
  };
}
