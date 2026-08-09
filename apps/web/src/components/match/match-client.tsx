"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CollegePicker, type CollegeOption } from "@/components/match/college-picker";
import { API_URL, cn } from "@/lib/utils";
import { getCompareIds, setCompareIds } from "@/lib/storage";

interface DimensionDef {
  id: string;
  label: string;
  description: string;
  category: string;
  controlType: string;
  supportsHardConstraint: boolean;
  defaultImportance: number;
}

interface MatchReasons {
  positives: string[];
  tradeoffs: string[];
  unknowns: string[];
}

interface EligibleResult {
  dormId: string;
  name: string;
  slug?: string;
  matchScore: number;
  confidence: number;
  confidenceLabel: string;
  reasons: MatchReasons;
}

interface ExcludedResult {
  dormId: string;
  name: string;
  slug?: string;
  reasons: string[];
}

interface MatchResponse {
  college: { id: string; name: string; slug: string };
  eligible: EligibleResult[];
  excluded: ExcludedResult[];
  algorithmVersion?: string;
}

/** Quick statements → preference weight ids (0–4 scale). */
const QUICK_STATEMENTS: {
  id: string;
  label: string;
  weightKey: string;
  hardKey?: string;
}[] = [
  { id: "social", label: "I want a social hall", weightKey: "socialAtmosphere" },
  { id: "quiet", label: "I want a quieter hall", weightKey: "quietAtmosphere" },
  { id: "space", label: "Room space matters to me", weightKey: "roomSpaciousness" },
  { id: "bath", label: "I want a private bathroom", weightKey: "bathroomPrivacy", hardKey: "requirePrivateBath" },
  { id: "ac", label: "I need air conditioning", weightKey: "airConditioning", hardKey: "requireAC" },
  { id: "afford", label: "Affordability is a priority", weightKey: "affordability" },
  { id: "location", label: "Campus location matters", weightKey: "location" },
];

const IMPORTANCE_LABELS = ["Skip", "Low", "Medium", "High", "Must-have feel"];

function confidenceTone(label: string) {
  if (label === "high") return "text-primary";
  if (label === "medium") return "text-foreground";
  return "text-muted-foreground";
}

export function MatchClient({ collegeSlug }: { collegeSlug?: string }) {
  const [step, setStep] = useState<1 | 2 | 3 | "results">(1);
  const [college, setCollege] = useState<CollegeOption | null>(null);
  const [quick, setQuick] = useState<Record<string, boolean>>({});
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [hard, setHard] = useState<Record<string, boolean | number | null>>({});
  const [maxBudget, setMaxBudget] = useState("");
  const [dimensions, setDimensions] = useState<DimensionDef[]>([]);
  const [loadingDefs, setLoadingDefs] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MatchResponse | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setCompare(getCompareIds());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/preferences/definitions`);
        if (!res.ok) throw new Error("defs");
        const data = await res.json();
        setDimensions(data.dimensions ?? []);
        setWeights(data.defaultWeights ?? {});
        setHard(data.emptyHardConstraints ?? {});
      } catch {
        setError("Could not load preference definitions.");
      } finally {
        setLoadingDefs(false);
      }
    })();
  }, []);

  const onSelectCollege = useCallback((c: CollegeOption) => setCollege(c), []);
  const onClearCollege = useCallback(() => setCollege(null), []);

  const softDimensions = useMemo(
    () =>
      dimensions.filter(
        (d) => d.controlType === "importance" || d.controlType === "spectrum" || d.controlType === "toggle"
      ),
    [dimensions]
  );

  const hardDimensions = useMemo(
    () => dimensions.filter((d) => d.supportsHardConstraint || d.controlType === "requirement"),
    [dimensions]
  );

  function applyQuickToWeights(): Record<string, number> {
    const next = { ...weights };
    for (const s of QUICK_STATEMENTS) {
      if (quick[s.id]) next[s.weightKey] = Math.max(next[s.weightKey] ?? 0, 3);
      else if (next[s.weightKey] === 3 && !showAdvanced) {
        /* leave advanced edits alone once opened */
      }
    }
    return next;
  }

  function applyQuickToHard(): Record<string, boolean | number | null> {
    const next = { ...hard };
    for (const s of QUICK_STATEMENTS) {
      if (s.hardKey) next[s.hardKey] = !!quick[s.id];
    }
    if (maxBudget.trim()) {
      const n = Number(maxBudget);
      if (!Number.isNaN(n) && n > 0) next.maxBudget = n;
    } else {
      next.maxBudget = null;
    }
    return next;
  }

  async function runMatch(nextWeights?: Record<string, number>, nextHard?: Record<string, boolean | number | null>) {
    if (!college) {
      setError("Pick a college first.");
      setStep(1);
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const w = nextWeights ?? applyQuickToWeights();
      const h = nextHard ?? applyQuickToHard();
      setWeights(w);
      setHard(h);
      const res = await fetch(`${API_URL}/api/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collegeSlug: college.slug,
          weights: w,
          hardConstraints: h,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Match failed (${res.status})`);
      }
      const data: MatchResponse = await res.json();
      setResults(data);
      setStep("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Match failed");
    } finally {
      setRunning(false);
    }
  }

  function toggleCompare(dormId: string) {
    const ids = getCompareIds();
    const next = ids.includes(dormId) ? ids.filter((x) => x !== dormId) : [...ids, dormId].slice(0, 4);
    setCompareIds(next);
    setCompare(next);
  }

  if (loadingDefs) {
    return <p className="text-muted-foreground">Loading preferences…</p>;
  }

  return (
    <div className="space-y-8">
      {step !== "results" && (
        <ol className="flex flex-wrap gap-2 text-sm" aria-label="Progress">
          {[
            { n: 1 as const, label: "College" },
            { n: 2 as const, label: "What matters" },
            { n: 3 as const, label: "Fine-tune" },
          ].map((s) => (
            <li
              key={s.n}
              className={cn(
                "rounded-full px-3 py-1",
                step === s.n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {s.n}. {s.label}
            </li>
          ))}
        </ol>
      )}

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <CollegePicker
            value={college}
            onSelect={onSelectCollege}
            onClear={onClearCollege}
            preselectedSlug={collegeSlug}
          />
          <Button disabled={!college} onClick={() => setStep(2)}>
            Continue
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-2xl">What matters most?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tap statements that feel true. You can refine weights next.
            </p>
          </div>
          <ul className="space-y-2">
            {QUICK_STATEMENTS.map((s) => {
              const on = !!quick[s.id];
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setQuick((q) => ({ ...q, [s.id]: !q[s.id] }))}
                    className={cn(
                      "w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                      on
                        ? "border-primary bg-accent text-foreground"
                        : "border-border bg-card hover:border-primary/40"
                    )}
                  >
                    {s.label}
                    {s.hardKey && on && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Also treated as a hard requirement (halls without evidence stay eligible)
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setWeights(applyQuickToWeights());
                setHard(applyQuickToHard());
                setStep(3);
              }}
            >
              Advanced options
            </Button>
            <Button
              onClick={() => runMatch()}
              disabled={running}
            >
              {running ? "Ranking…" : "See my rankings"}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8">
          <div>
            <h2 className="font-display text-2xl">Fine-tune preferences</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Soft weights influence ranking. Hard requirements exclude halls that fail (unknown does not fail).
            </p>
          </div>

          <fieldset className="space-y-4">
            <legend className="font-medium">Soft preference weights</legend>
            <div className="space-y-4">
              {softDimensions.slice(0, showAdvanced ? undefined : 12).map((d) => (
                <div key={d.id} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <label htmlFor={`w-${d.id}`} className="text-sm font-medium">
                      {d.label}
                    </label>
                    <p className="text-xs text-muted-foreground">{d.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id={`w-${d.id}`}
                      type="range"
                      min={0}
                      max={4}
                      step={1}
                      value={weights[d.id] ?? d.defaultImportance ?? 0}
                      onChange={(e) =>
                        setWeights((w) => ({ ...w, [d.id]: Number(e.target.value) }))
                      }
                      className="w-36 accent-[hsl(var(--primary))]"
                      aria-valuetext={IMPORTANCE_LABELS[weights[d.id] ?? 0]}
                    />
                    <span className="w-16 text-xs text-muted-foreground tabular-nums">
                      {IMPORTANCE_LABELS[weights[d.id] ?? 0]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {!showAdvanced && softDimensions.length > 12 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdvanced(true)}>
                Show all preferences
              </Button>
            )}
          </fieldset>

          <fieldset className="space-y-4 rounded-lg border border-border bg-card p-4">
            <legend className="px-1 font-medium">Hard requirements</legend>
            <p className="text-xs text-muted-foreground">
              Clearly labeled filters. Missing data does not exclude a hall.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { key: "requireFreshmanEligible", label: "Freshman-eligible" },
                { key: "requirePrivateBath", label: "Private bathroom" },
                { key: "requirePrivateOrSuiteBath", label: "Private or suite bath" },
                { key: "requireAC", label: "Air conditioning" },
                { key: "requireSingle", label: "Single room available" },
                { key: "requireGenderInclusive", label: "Gender-inclusive" },
                { key: "requireAccessibility", label: "Accessibility features" },
                { key: "requireSubstanceFree", label: "Substance-free" },
              ].map((h) => (
                <label key={h.key} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 accent-[hsl(var(--primary))]"
                    checked={!!hard[h.key]}
                    onChange={(e) => setHard((prev) => ({ ...prev, [h.key]: e.target.checked }))}
                  />
                  <span>
                    <span className="font-medium">{h.label}</span>
                    <span className="block text-xs text-muted-foreground">Hard requirement</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="max-w-xs">
              <label htmlFor="max-budget" className="text-sm font-medium">
                Max yearly budget (optional)
              </label>
              <Input
                id="max-budget"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="e.g. 12000"
                className="mt-1"
                value={maxBudget}
                onChange={(e) => setMaxBudget(e.target.value)}
              />
            </div>
            {hardDimensions.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Additional requirement dimensions from the preference registry are available via the API keys above.
              </p>
            )}
          </fieldset>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button onClick={() => runMatch(weights, applyQuickToHard())} disabled={running || !college}>
              {running ? "Ranking…" : "Rank dorms"}
            </Button>
          </div>
        </div>
      )}

      {step === "results" && results && (
        <div className="space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{results.college.name}</p>
              <h2 className="font-display text-3xl tracking-tight">Your ranked dorms</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {results.eligible.length} eligible
                {results.excluded.length > 0 ? ` · ${results.excluded.length} excluded by hard constraints` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAdvanced(true);
                  setStep(3);
                }}
              >
                Fine-tune & re-rank
              </Button>
              {compare.length >= 2 && (
                <Link href="/compare">
                  <Button variant="secondary">Compare selected ({compare.length})</Button>
                </Link>
              )}
            </div>
          </div>

          {results.eligible.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-6">
              <p className="font-medium">No halls matched your hard requirements.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Relax a constraint or turn on excluded halls below to see what was filtered out.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {results.eligible.map((r, idx) => (
                <li key={r.dormId} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">#{idx + 1}</p>
                      {r.slug ? (
                        <Link
                          href={`/colleges/${results.college.slug}/dorms/${r.slug}`}
                          className="font-display text-xl hover:text-primary"
                        >
                          {r.name}
                        </Link>
                      ) : (
                        <span className="font-display text-xl">{r.name}</span>
                      )}
                      <p className={cn("mt-1 text-xs capitalize", confidenceTone(r.confidenceLabel))}>
                        Confidence: {r.confidenceLabel.replace("_", " ")} ({Math.round(r.confidence)}%)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="match-score font-display text-3xl tabular-nums">{Math.round(r.matchScore)}%</p>
                      <p className="text-xs text-muted-foreground">match</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <ReasonList title="Why it fits" items={r.reasons?.positives} tone="pos" />
                    <ReasonList title="Tradeoffs" items={r.reasons?.tradeoffs} tone="trade" />
                    <ReasonList title="Unknowns" items={r.reasons?.unknowns} tone="unk" />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={compare.includes(r.dormId)}
                        onChange={() => toggleCompare(r.dormId)}
                        className="accent-[hsl(var(--primary))]"
                      />
                      Compare
                    </label>
                    {r.slug && (
                      <Link
                        href={`/colleges/${results.college.slug}/dorms/${r.slug}`}
                        className="text-sm text-primary underline-offset-2 hover:underline"
                      >
                        Open dorm page
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {results.excluded.length > 0 && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={showExcluded}
                  onChange={(e) => setShowExcluded(e.target.checked)}
                  className="accent-[hsl(var(--primary))]"
                />
                Show halls excluded by hard constraints ({results.excluded.length})
              </label>
              {showExcluded && (
                <ul className="space-y-2">
                  {results.excluded.map((e) => (
                    <li key={e.dormId} className="rounded-md border border-dashed border-border px-4 py-3 text-sm">
                      <span className="font-medium">{e.name}</span>
                      <span className="mt-1 block text-muted-foreground">{e.reasons.join(" · ")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <Button
            variant="ghost"
            onClick={() => {
              setResults(null);
              setStep(1);
            }}
          >
            Start over
          </Button>
        </div>
      )}
    </div>
  );
}

function ReasonList({
  title,
  items,
  tone,
}: {
  title: string;
  items?: string[];
  tone: "pos" | "trade" | "unk";
}) {
  const list = items?.length ? items : ["—"];
  return (
    <div>
      <p
        className={cn(
          "text-xs font-medium uppercase tracking-wide",
          tone === "pos" && "text-primary",
          tone === "trade" && "text-score",
          tone === "unk" && "text-muted-foreground"
        )}
      >
        {title}
      </p>
      <ul className="mt-1 space-y-1 text-muted-foreground">
        {list.slice(0, 4).map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

