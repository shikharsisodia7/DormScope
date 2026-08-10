type DormLike = {
  yearlyCost?: number | null;
  freshmanEligible?: boolean | null;
  socialVibe?: number | null;
  quietVibe?: number | null;
  isAssignableHousingOption?: boolean;
  rankingGranularity?: boolean;
  dormScore?: {
    overallScore?: number | null;
    scoreable?: boolean;
    freshmanFitScore?: number | null;
    valueScore?: number | null;
  } | null;
  name: string;
};

export type CollegeHighlight = {
  name: string;
  yearlyCost?: number | null;
} | null;

function isRankableWithScore(d: DormLike): boolean {
  if (d.isAssignableHousingOption === false || d.rankingGranularity === false) return false;
  const ds = d.dormScore;
  if (!ds) return false;
  if (ds.scoreable === false) return false;
  return ds.overallScore != null;
}

/** Build college highlights without mutating the source dorms array. */
export function buildCollegeHighlights<T extends DormLike>(dorms: T[]) {
  const rankable = dorms.filter(isRankableWithScore);

  const withCost = dorms.filter((d) => d.yearlyCost != null);
  const costs = withCost.map((d) => d.yearlyCost!) as number[];
  const avgCost = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;

  const byCostAsc = [...withCost].sort((a, b) => (a.yearlyCost ?? 0) - (b.yearlyCost ?? 0));
  const byCostDesc = [...withCost].sort((a, b) => (b.yearlyCost ?? 0) - (a.yearlyCost ?? 0));

  const freshman = [...rankable.filter((d) => d.freshmanEligible)].sort(
    (a, b) => (b.dormScore?.freshmanFitScore ?? 0) - (a.dormScore?.freshmanFitScore ?? 0)
  );
  const freshmanWithScore = freshman.filter((d) => d.dormScore?.freshmanFitScore != null);

  const byValue = [...rankable]
    .filter((d) => d.dormScore?.valueScore != null)
    .sort((a, b) => (b.dormScore?.valueScore ?? 0) - (a.dormScore?.valueScore ?? 0));

  const bySocial = [...rankable]
    .filter((d) => d.socialVibe != null)
    .sort((a, b) => (b.socialVibe ?? 0) - (a.socialVibe ?? 0));

  const byQuiet = [...rankable]
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
