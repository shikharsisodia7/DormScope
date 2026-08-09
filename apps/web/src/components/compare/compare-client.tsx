"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCompareIds, exportComparisonCsv as exportCsv } from "@/lib/storage";
import { API_URL, factLabel, moneyOrUnknown } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CompareDorm {
  id: string;
  name: string;
  slug?: string;
  yearlyCost?: number | null;
  bathroomStyle?: string | null;
  hasAC?: boolean | null;
  freshmanEligible?: boolean | null;
  socialVibe?: number | null;
  quietVibe?: number | null;
  elevatorAccess?: boolean | null;
  laundryAccess?: boolean | null;
  college: { name: string; slug?: string };
  dormScore?: {
    overallScore: number;
    valueScore: number;
    privacyScore: number;
    comfortScore: number;
  } | null;
}

export function CompareClient() {
  const [dorms, setDorms] = useState<CompareDorm[]>([]);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ids = getCompareIds();
    if (!ids.length) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/dorms/compare`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (!res.ok) throw new Error("Could not load comparison");
        const data = await res.json();
        setDorms(Array.isArray(data) ? data : data.dorms ?? []);
        try {
          const s = await fetch(`${API_URL}/api/recommend/compare-summary`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
          });
          if (s.ok) {
            const j = await s.json();
            setSummary(j.summary ?? "");
          }
        } catch {
          /* optional */
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <p className="text-muted-foreground" role="status">Loading comparison…</p>;
  }

  if (error) {
    return <p className="text-destructive" role="alert">{error}</p>;
  }

  if (!dorms.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/50 px-6 py-12 text-center">
        <p className="font-medium">No dorms in your comparison list.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Open a dorm page or match results and check &quot;Compare&quot; (up to 4).
        </p>
        <Link href="/match" className="mt-6 inline-block">
          <Button>Find My Best Dorm</Button>
        </Link>
      </div>
    );
  }

  const rows: { label: string; value: (d: CompareDorm) => string }[] = [
    { label: "Yearly cost", value: (d) => moneyOrUnknown(d.yearlyCost) },
    {
      label: "Bathroom",
      value: (d) => d.bathroomStyle?.replace(/_/g, " ") ?? "Unknown",
    },
    { label: "AC", value: (d) => factLabel(d.hasAC) },
    { label: "Freshman eligible", value: (d) => factLabel(d.freshmanEligible) },
    { label: "Elevator", value: (d) => factLabel(d.elevatorAccess) },
    { label: "Laundry", value: (d) => factLabel(d.laundryAccess) },
    {
      label: "Social vibe",
      value: (d) => (d.socialVibe != null ? String(d.socialVibe) : "Unknown"),
    },
    {
      label: "Quiet vibe",
      value: (d) => (d.quietVibe != null ? String(d.quietVibe) : "Unknown"),
    },
    {
      label: "Overall score",
      value: (d) =>
        d.dormScore?.overallScore != null ? String(d.dormScore.overallScore) : "Unknown",
    },
    {
      label: "Privacy score",
      value: (d) =>
        d.dormScore?.privacyScore != null ? String(d.dormScore.privacyScore) : "Unknown",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Side-by-side dorm comparison</caption>
          <thead>
            <tr className="bg-muted/60">
              <th scope="col" className="p-3 text-left font-medium">
                Metric
              </th>
              {dorms.map((d) => (
                <th key={d.id} scope="col" className="p-3 text-left font-medium">
                  {d.college.slug && d.slug ? (
                    <Link
                      href={`/colleges/${d.college.slug}/dorms/${d.slug}`}
                      className="hover:text-primary"
                    >
                      {d.name}
                    </Link>
                  ) : (
                    d.name
                  )}
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    {d.college.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-border/70">
                <th scope="row" className="p-3 text-left font-medium text-muted-foreground">
                  {row.label}
                </th>
                {dorms.map((d) => {
                  const v = row.value(d);
                  return (
                    <td
                      key={d.id}
                      className={
                        v === "Unknown" ? "p-3 text-muted-foreground italic" : "p-3"
                      }
                    >
                      {v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        <strong>Unknown</strong> means we lack evidence — not the same as <strong>No</strong>.
      </p>

      {summary && (
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-display text-lg">Recommendation</h2>
          <p className="mt-2 text-sm text-muted-foreground">{summary}</p>
        </section>
      )}

      <Button
        variant="outline"
        onClick={() =>
          exportCsv(
            dorms.map((d) => ({
              name: d.name,
              college: d.college.name,
              yearlyCost: d.yearlyCost ?? "Unknown",
              bathroomStyle: d.bathroomStyle ?? "Unknown",
              hasAC: factLabel(d.hasAC),
              overallScore: d.dormScore?.overallScore ?? "Unknown",
            }))
          )
        }
      >
        Export CSV
      </Button>
    </div>
  );
}
