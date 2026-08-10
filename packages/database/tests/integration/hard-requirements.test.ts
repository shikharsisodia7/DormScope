/**
 * Integration: hard requirements
 *
 * Tests the tri-state boolean semantics (true / false / null=unknown) for
 * bathroom and AC fields via `filterByHardConstraints` and the personalizedRanker.
 *
 * Key invariants:
 *   - hasAC=true  + requireAC=true  → eligible
 *   - hasAC=false + requireAC=true  → excluded
 *   - hasAC=null  + requireAC=true  → unverified (not silently treated as satisfied)
 *   - bathroomStyle=COMMUNAL + requirePrivateBath=true → excluded
 *   - bathroomStyle=null + requirePrivateBath=true     → unverified
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { filterByHardConstraints } from "@dormscope/scoring";
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

describe("hard requirements — tri-state AC semantics", () => {
  function dormWithAC(id: string, hasAC: boolean | null | undefined): RankableDorm {
    return { id, name: `Dorm ${id}`, hasAC };
  }

  test("hasAC=true → eligible when requireAC", () => {
    const dorms = [dormWithAC("ac-true", true)];
    const { eligible, excluded, unverified } = filterByHardConstraints(dorms, {
      requireAC: true,
    });
    expect(eligible).toHaveLength(1);
    expect(excluded).toHaveLength(0);
    expect(unverified).toHaveLength(0);
  });

  test("hasAC=false → excluded when requireAC", () => {
    const dorms = [dormWithAC("ac-false", false)];
    const { eligible, excluded, unverified } = filterByHardConstraints(dorms, {
      requireAC: true,
    });
    expect(excluded).toHaveLength(1);
    expect(eligible).toHaveLength(0);
    expect(unverified).toHaveLength(0);
  });

  test("hasAC=null → unverified when requireAC (never silently satisfied)", () => {
    const dorms = [dormWithAC("ac-null", null)];
    const { eligible, excluded, unverified } = filterByHardConstraints(dorms, {
      requireAC: true,
    });
    expect(unverified).toHaveLength(1);
    expect(excluded).toHaveLength(0);
    expect(eligible).toHaveLength(0);
  });

  test("hasAC=undefined → unverified when requireAC", () => {
    const dorms = [dormWithAC("ac-undef", undefined)];
    const { eligible, excluded, unverified } = filterByHardConstraints(dorms, {
      requireAC: true,
    });
    expect(unverified).toHaveLength(1);
  });

  test("no requireAC constraint → all pass regardless of hasAC", () => {
    const dorms = [
      dormWithAC("ac-t", true),
      dormWithAC("ac-f", false),
      dormWithAC("ac-n", null),
    ];
    const { eligible, excluded, unverified } = filterByHardConstraints(dorms, {});
    expect(eligible).toHaveLength(3);
    expect(excluded).toHaveLength(0);
    expect(unverified).toHaveLength(0);
  });
});

describe("hard requirements — tri-state bathroom semantics", () => {
  function dormWithBath(
    id: string,
    bathroomStyle: string | null | undefined
  ): RankableDorm {
    return { id, name: `Bath ${id}`, bathroomStyle };
  }

  test("bathroomStyle=PRIVATE → eligible when requirePrivateBath", () => {
    const { eligible } = filterByHardConstraints(
      [dormWithBath("priv", "PRIVATE")],
      { requirePrivateBath: true }
    );
    expect(eligible).toHaveLength(1);
  });

  test("bathroomStyle=COMMUNAL → excluded when requirePrivateBath", () => {
    const { excluded } = filterByHardConstraints(
      [dormWithBath("comm", "COMMUNAL")],
      { requirePrivateBath: true }
    );
    expect(excluded).toHaveLength(1);
  });

  test("bathroomStyle=null → unverified when requirePrivateBath", () => {
    const { unverified } = filterByHardConstraints(
      [dormWithBath("null-bath", null)],
      { requirePrivateBath: true }
    );
    expect(unverified).toHaveLength(1);
  });

  test("bathroomStyle=UNKNOWN → unverified when requirePrivateBath", () => {
    const { unverified } = filterByHardConstraints(
      [dormWithBath("unk-bath", "UNKNOWN")],
      { requirePrivateBath: true }
    );
    expect(unverified).toHaveLength(1);
  });
});

describe("hard requirements — budget constraint", () => {
  function dormWithCost(id: string, yearlyCost: number | null): RankableDorm {
    return { id, name: `Cost ${id}`, yearlyCost };
  }

  test("yearlyCost below budget → eligible", () => {
    const { eligible } = filterByHardConstraints(
      [dormWithCost("cheap", 9000)],
      { maxBudget: 12000 }
    );
    expect(eligible).toHaveLength(1);
  });

  test("yearlyCost above budget → excluded", () => {
    const { excluded } = filterByHardConstraints(
      [dormWithCost("expensive", 15000)],
      { maxBudget: 12000 }
    );
    expect(excluded).toHaveLength(1);
  });

  test("yearlyCost=null → unverified when maxBudget set", () => {
    const { unverified } = filterByHardConstraints(
      [dormWithCost("no-cost", null)],
      { maxBudget: 12000 }
    );
    expect(unverified).toHaveLength(1);
  });
});

describe("hard requirements — DB-backed fixtures", () => {
  test("unit1 fixture (hasAC=false) excluded when requireAC=true", async () => {
    const { unit1 } = fixtures.dorms;

    const dorm = await prisma.dorm.findUniqueOrThrow({
      where: { id: unit1.id },
      select: { id: true, name: true, hasAC: true, freshmanEligible: true },
    });

    const rankable: RankableDorm = {
      id: dorm.id,
      name: dorm.name,
      hasAC: dorm.hasAC,
      freshmanEligible: dorm.freshmanEligible,
    };

    const { excluded } = filterByHardConstraints([rankable], { requireAC: true });
    expect(excluded).toHaveLength(1);
    expect(excluded[0].dorm.id).toBe(unit1.id);
  });
});
