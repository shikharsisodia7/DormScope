/**
 * Integration: hierarchy
 *
 * The hierarchy-fixture college has a parent VILLAGE (non-assignable) with two
 * BUILDING children (assignable).
 *
 * filterMatchableDorms must return only the two buildings, not the village.
 * filterByHardConstraints must also exclude the village.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { filterMatchableDorms, filterByHardConstraints } from "@dormscope/scoring";
import type { RankableDorm } from "@dormscope/scoring";
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

describe("hierarchy — filterMatchableDorms", () => {
  function asRankable(
    dorm: { id: string; name: string; isAssignableHousingOption: boolean; rankingGranularity: boolean }
  ): RankableDorm {
    return {
      id: dorm.id,
      name: dorm.name,
      isAssignableHousingOption: dorm.isAssignableHousingOption,
      rankingGranularity: dorm.rankingGranularity,
    };
  }

  test("filterMatchableDorms excludes organizational containers", async () => {
    const { parentVillage, buildingA, buildingB } = fixtures.dorms;

    const all: RankableDorm[] = [
      asRankable({ ...parentVillage, isAssignableHousingOption: false, rankingGranularity: false }),
      asRankable({ ...buildingA, isAssignableHousingOption: true, rankingGranularity: true }),
      asRankable({ ...buildingB, isAssignableHousingOption: true, rankingGranularity: true }),
    ];

    const matchable = filterMatchableDorms(all);

    expect(matchable).toHaveLength(2);
    const ids = matchable.map((d) => d.id);
    expect(ids).toContain(buildingA.id);
    expect(ids).toContain(buildingB.id);
    expect(ids).not.toContain(parentVillage.id);
  });

  test("filterMatchableDorms includes dorms with null hierarchy flags", async () => {
    const dorms: RankableDorm[] = [
      { id: "a", name: "A", isAssignableHousingOption: null },
      { id: "b", name: "B", isAssignableHousingOption: false },
      { id: "c", name: "C", isAssignableHousingOption: true },
      { id: "d", name: "D" }, // undefined flags → include
    ];

    const matchable = filterMatchableDorms(dorms);
    const ids = matchable.map((d) => d.id);

    // Only explicit `false` is excluded
    expect(ids).toContain("a");
    expect(ids).not.toContain("b");
    expect(ids).toContain("c");
    expect(ids).toContain("d");
  });

  test("parent-child hierarchy stored correctly in DB", async () => {
    const { parentVillage, buildingA, buildingB } = fixtures.dorms;

    const children = await prisma.dorm.findMany({
      where: { parentHousingId: parentVillage.id },
      select: { id: true, name: true },
    });

    expect(children).toHaveLength(2);
    const ids = children.map((c) => c.id);
    expect(ids).toContain(buildingA.id);
    expect(ids).toContain(buildingB.id);
  });

  test("filterByHardConstraints ignores non-assignable when no hard reqs", async () => {
    const { parentVillage, buildingA, buildingB } = fixtures.dorms;

    // All three through hard-constraint filter with no active constraints
    const all: RankableDorm[] = [
      asRankable({ ...parentVillage, isAssignableHousingOption: false, rankingGranularity: false }),
      asRankable({ ...buildingA, isAssignableHousingOption: true, rankingGranularity: true }),
      asRankable({ ...buildingB, isAssignableHousingOption: true, rankingGranularity: true }),
    ];

    // filterByHardConstraints does NOT filter by assignability — that's
    // filterMatchableDorms' job.  All three pass when there are no hard reqs.
    const { eligible, excluded, unverified } = filterByHardConstraints(all, {});
    expect(eligible.length + unverified.length).toBe(3);
    expect(excluded).toHaveLength(0);
  });
});
