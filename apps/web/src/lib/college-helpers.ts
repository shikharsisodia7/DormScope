type DormLike = {
  yearlyCost?: number | null;
  freshmanEligible?: boolean | null;
  socialVibe?: number | null;
  quietVibe?: number | null;
  dormScore?: {
    freshmanFitScore?: number | null;
    valueScore?: number | null;
  } | null;
  name: string;
};

export type CollegeHighlight = {
  name: string;
  yearlyCost?: number | null;
} | null;

/** Build college highlights without mutating the source dorms array. */
export function buildCollegeHighlights<T extends DormLike>(dorms: T[]) {
  const withCost = dorms.filter((d) => d.yearlyCost != null);
  const costs = withCost.map((d) => d.yearlyCost!) as number[];
  const avgCost = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;

  const byCostAsc = [...withCost].sort((a, b) => (a.yearlyCost ?? 0) - (b.yearlyCost ?? 0));
  const byCostDesc = [...withCost].sort((a, b) => (b.yearlyCost ?? 0) - (a.yearlyCost ?? 0));

  const freshman = [...dorms.filter((d) => d.freshmanEligible)].sort(
    (a, b) => (b.dormScore?.freshmanFitScore ?? 0) - (a.dormScore?.freshmanFitScore ?? 0)
  );
  const freshmanWithScore = freshman.filter((d) => d.dormScore?.freshmanFitScore != null);

  const byValue = [...dorms]
    .filter((d) => d.dormScore?.valueScore != null)
    .sort((a, b) => (b.dormScore?.valueScore ?? 0) - (a.dormScore?.valueScore ?? 0));

  const bySocial = [...dorms]
    .filter((d) => d.socialVibe != null)
    .sort((a, b) => (b.socialVibe ?? 0) - (a.socialVibe ?? 0));

  const byQuiet = [...dorms]
    .filter((d) => d.quietVibe != null)
    .sort((a, b) => (b.quietVibe ?? 0) - (a.quietVibe ?? 0));

  return {
    avgCost,
    hasCostEvidence: withCost.length > 0,
    cheapest: byCostAsc[0] ?? null,
    expensive: byCostDesc[0] ?? null,
    bestFreshman: freshmanWithScore[0] ?? null,
    bestValue: byValue[0] ?? null,
    mostSocial: bySocial[0] ?? null,
    quietest: byQuiet[0] ?? null,
  };
}
