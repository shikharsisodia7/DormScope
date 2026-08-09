import { describe, expect, it } from "vitest";
import { PreferenceImportance, type PreferenceProfile } from "@dormscope/shared";
import {
  ALGORITHM_VERSION,
  filterByHardConstraints,
  rankDormsForPreferences,
  type RankableDorm,
} from "./personalizedRanker";

function dorm(partial: Partial<RankableDorm> & { id: string; name: string }): RankableDorm {
  return {
    collegeName: "Test U",
    confidenceScore: 0.8,
    dataCompletenessScore: 0.8,
    lastUpdatedAt: new Date("2026-01-01"),
    ...partial,
  };
}

const fixtures: RankableDorm[] = [
  dorm({
    id: "private-hall",
    name: "Private Hall",
    bathroomStyle: "PRIVATE",
    socialVibe: 4,
    quietVibe: 8,
    spaciousnessRating: 9,
    freshmanEligible: true,
    hasAC: true,
    yearlyCost: 12000,
  }),
  dorm({
    id: "communal-hall",
    name: "Communal Hall",
    bathroomStyle: "COMMUNAL",
    socialVibe: 9,
    quietVibe: 3,
    spaciousnessRating: 4,
    freshmanEligible: true,
    hasAC: false,
    yearlyCost: 10000,
  }),
  dorm({
    id: "suite-hall",
    name: "Suite Hall",
    bathroomStyle: "SUITE",
    socialVibe: 6,
    quietVibe: 6,
    spaciousnessRating: 7,
    freshmanEligible: true,
    hasAC: true,
    yearlyCost: 14000,
  }),
  dorm({
    id: "unknown-bath",
    name: "Mystery Hall",
    bathroomStyle: "UNKNOWN",
    socialVibe: 7,
    quietVibe: 5,
    spaciousnessRating: 6,
    freshmanEligible: true,
    hasAC: true,
    yearlyCost: 11000,
  }),
  dorm({
    id: "upperclass-only",
    name: "Senior Suites",
    bathroomStyle: "PRIVATE",
    socialVibe: 5,
    quietVibe: 7,
    spaciousnessRating: 8,
    freshmanEligible: false,
    hasAC: true,
    yearlyCost: 15000,
  }),
];

describe("filterByHardConstraints", () => {
  it("excludes communal halls when private bathroom is required", () => {
    const { eligible, excluded, unverified } = filterByHardConstraints(fixtures, {
      requirePrivateBath: true,
    });
    expect(eligible.map((d) => d.id)).not.toContain("communal-hall");
    expect(eligible.map((d) => d.id)).not.toContain("suite-hall");
    expect(excluded.some((e) => e.dorm.id === "communal-hall")).toBe(true);
    // Unknown bathroom is NOT silently treated as satisfied
    expect(unverified.map((u) => u.dorm.id)).toContain("unknown-bath");
    expect(eligible.map((d) => d.id)).not.toContain("unknown-bath");
  });

  it("excludes communal when private-or-suite is required", () => {
    const { eligible, excluded } = filterByHardConstraints(fixtures, {
      requirePrivateOrSuiteBath: true,
    });
    expect(eligible.map((d) => d.id)).toContain("private-hall");
    expect(eligible.map((d) => d.id)).toContain("suite-hall");
    expect(eligible.map((d) => d.id)).not.toContain("communal-hall");
    expect(excluded.find((e) => e.dorm.id === "communal-hall")?.reasons.length).toBeGreaterThan(0);
  });

  it("filters out non-freshman-eligible halls when required", () => {
    const { eligible, excluded } = filterByHardConstraints(fixtures, {
      requireFreshmanEligible: true,
    });
    expect(eligible.map((d) => d.id)).not.toContain("upperclass-only");
    expect(excluded.some((e) => e.dorm.id === "upperclass-only")).toBe(true);
    expect(eligible.map((d) => d.id)).toContain("private-hall");
  });

  it("puts unknown AC into unverified when AC is required", () => {
    const { eligible, unverified, excluded } = filterByHardConstraints(
      [
        dorm({ id: "has-ac", name: "Cool Hall", hasAC: true }),
        dorm({ id: "no-ac", name: "Warm Hall", hasAC: false }),
        dorm({ id: "unk-ac", name: "Mystery AC", hasAC: null }),
      ],
      { requireAC: true }
    );
    expect(eligible.map((d) => d.id)).toEqual(["has-ac"]);
    expect(excluded.map((e) => e.dorm.id)).toContain("no-ac");
    expect(unverified.map((u) => u.dorm.id)).toContain("unk-ac");
  });

  it("puts unknown budget into unverified when maxBudget is set", () => {
    const { eligible, unverified, excluded } = filterByHardConstraints(
      [
        dorm({ id: "cheap", name: "Cheap", yearlyCost: 8000 }),
        dorm({ id: "pricey", name: "Pricey", yearlyCost: 20000 }),
        dorm({ id: "unk-cost", name: "Unknown Cost", yearlyCost: null }),
      ],
      { maxBudget: 12000 }
    );
    expect(eligible.map((d) => d.id)).toEqual(["cheap"]);
    expect(excluded.map((e) => e.dorm.id)).toContain("pricey");
    expect(unverified.map((u) => u.dorm.id)).toContain("unk-cost");
  });
});

describe("rankDormsForPreferences", () => {
  it("soft private bathroom preference ranks communal lower but includes it", () => {
    const profile: PreferenceProfile = {
      weights: {
        privateBathroom: PreferenceImportance.VERY,
        socialAtmosphere: PreferenceImportance.SOMEWHAT,
      },
      hardConstraints: {},
    };
    const ranked = rankDormsForPreferences(fixtures, profile);
    const ids = ranked.map((r) => r.dorm.id);
    expect(ids).toContain("communal-hall");
    expect(ids).toContain("private-hall");
    const privateRank = ranked.find((r) => r.dorm.id === "private-hall")!;
    const communalRank = ranked.find((r) => r.dorm.id === "communal-hall")!;
    expect(privateRank.matchScore).toBeGreaterThan(communalRank.matchScore);
  });

  it("high space + low social vs opposite produces different orderings", () => {
    const spaceProfile: PreferenceProfile = {
      weights: {
        roomSpaciousness: PreferenceImportance.MUST,
        socialAtmosphere: PreferenceImportance.SOMEWHAT,
      },
      hardConstraints: {},
    };
    const socialProfile: PreferenceProfile = {
      weights: {
        roomSpaciousness: PreferenceImportance.SOMEWHAT,
        socialAtmosphere: PreferenceImportance.MUST,
      },
      hardConstraints: {},
    };

    const bySpace = rankDormsForPreferences(fixtures, spaceProfile).map((r) => r.dorm.id);
    const bySocial = rankDormsForPreferences(fixtures, socialProfile).map((r) => r.dorm.id);

    expect(bySpace[0]).toBe("private-hall"); // spaciousness 9
    expect(bySocial[0]).toBe("communal-hall"); // social 9
    expect(bySpace).not.toEqual(bySocial);
  });

  it("unknown bathroom does not treat as communal; lowers confidence", () => {
    const profile: PreferenceProfile = {
      weights: {
        privateBathroom: PreferenceImportance.VERY,
        socialAtmosphere: PreferenceImportance.IMPORTANT,
      },
      hardConstraints: {},
    };
    const ranked = rankDormsForPreferences(fixtures, profile);
    const mystery = ranked.find((r) => r.dorm.id === "unknown-bath")!;
    expect(mystery).toBeDefined();
    // Dimension skipped — not scored as 0/communal
    expect(mystery.dimensionScores.privateBathroom.hasEvidence).toBe(false);
    expect(mystery.reasons.unknowns.some((u) => /bathroom/i.test(u))).toBe(true);
    // Confidence should be lower than a fully evidenced peer with same social weight
    const privateHall = ranked.find((r) => r.dorm.id === "private-hall")!;
    expect(mystery.confidence).toBeLessThan(privateHall.confidence);
  });

  it("freshman eligibility hard filter removes upperclass-only before scoring", () => {
    const profile: PreferenceProfile = {
      weights: {
        privacy: PreferenceImportance.IMPORTANT,
        roomSpaciousness: PreferenceImportance.IMPORTANT,
      },
      hardConstraints: { requireFreshmanEligible: true },
    };
    const ranked = rankDormsForPreferences(fixtures, profile);
    expect(ranked.map((r) => r.dorm.id)).not.toContain("upperclass-only");
  });

  it("is deterministic: same input yields same output", () => {
    const profile: PreferenceProfile = {
      weights: {
        socialAtmosphere: PreferenceImportance.IMPORTANT,
        quietAtmosphere: PreferenceImportance.IMPORTANT,
        roomSpaciousness: PreferenceImportance.VERY,
        privateBathroom: PreferenceImportance.SOMEWHAT,
      },
      hardConstraints: {},
    };
    const a = rankDormsForPreferences(fixtures, profile);
    const b = rankDormsForPreferences(fixtures, profile);
    expect(a.map((r) => ({ id: r.dorm.id, matchScore: r.matchScore, confidence: r.confidence }))).toEqual(
      b.map((r) => ({ id: r.dorm.id, matchScore: r.matchScore, confidence: r.confidence }))
    );
    expect(a.every((r) => r.algorithmVersion === ALGORITHM_VERSION)).toBe(true);
  });

  it("zero weights do not crash and return score 0", () => {
    const profile: PreferenceProfile = {
      weights: {},
      hardConstraints: {},
    };
    const ranked = rankDormsForPreferences(fixtures, profile);
    expect(ranked.length).toBe(fixtures.length);
    expect(ranked.every((r) => r.matchScore === 0)).toBe(true);
    // Tie-break by confidence then name ASC
    const names = ranked.map((r) => r.dorm.name);
    const sortedByNameWhenTied = [...ranked]
      .sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return a.dorm.name.localeCompare(b.dorm.name);
      })
      .map((r) => r.dorm.name);
    expect(names).toEqual(sortedByNameWhenTied);
  });
});
