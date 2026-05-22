"use client";

import { useEffect, useState } from "react";
import { getCompareIds } from "@/lib/storage";
import { API_URL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { exportComparisonCsv as exportCsv } from "@/lib/storage";

interface CompareDorm {
  id: string;
  name: string;
  yearlyCost?: number;
  bathroomStyle?: string;
  hasAC?: boolean;
  freshmanEligible?: boolean;
  socialVibe?: number;
  quietVibe?: number;
  college: { name: string };
  dormScore?: {
    overallScore: number;
    valueScore: number;
    privacyScore: number;
    comfortScore: number;
  };
}

export function CompareClient() {
  const [dorms, setDorms] = useState<CompareDorm[]>([]);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ids = getCompareIds();
    if (!ids.length) {
      setLoading(false);
      return;
    }
    fetch(`${API_URL}/api/dorms/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
      .then((r) => r.json())
      .then(async (data) => {
        setDorms(data);
        const s = await fetch(`${API_URL}/api/recommend/compare-summary`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        const j = await s.json();
        setSummary(j.summary ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading comparison...</p>;
  if (!dorms.length)
    return (
      <p className="text-muted-foreground">
        No dorms in your comparison list. Open a dorm profile and click &quot;Add to compare.&quot;
      </p>
    );

  const rows = [
    { label: "Yearly cost", key: (d: CompareDorm) => d.yearlyCost ? `$${d.yearlyCost.toLocaleString()}` : "—" },
    { label: "Bathroom", key: (d: CompareDorm) => d.bathroomStyle ?? "—" },
    { label: "AC", key: (d: CompareDorm) => (d.hasAC ? "Yes" : "No") },
    { label: "Freshman", key: (d: CompareDorm) => (d.freshmanEligible ? "Yes" : "No") },
    { label: "Social vibe", key: (d: CompareDorm) => d.socialVibe ?? "—" },
    { label: "Overall score", key: (d: CompareDorm) => d.dormScore?.overallScore ?? "—" },
    { label: "Privacy score", key: (d: CompareDorm) => d.dormScore?.privacyScore ?? "—" },
  ];

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="p-3 text-left">Metric</th>
              {dorms.map((d) => (
                <th key={d.id} className="p-3 text-left">
                  {d.name}
                  <span className="block text-xs font-normal text-muted-foreground">{d.college.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t">
                <td className="p-3 font-medium">{row.label}</td>
                {dorms.map((d) => (
                  <td key={d.id} className="p-3">
                    {row.key(d)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {summary && (
        <Card>
          <CardHeader><CardTitle>Recommendation</CardTitle></CardHeader>
          <CardContent><p>{summary}</p></CardContent>
        </Card>
      )}

      <Button
        variant="outline"
        onClick={() =>
          exportCsv(
            dorms.map((d) => ({
              name: d.name,
              college: d.college.name,
              yearlyCost: d.yearlyCost,
              bathroomStyle: d.bathroomStyle,
              overallScore: d.dormScore?.overallScore,
            }))
          )
        }
      >
        Export CSV
      </Button>
    </div>
  );
}
