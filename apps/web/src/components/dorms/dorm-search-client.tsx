"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DormCard, type DormCardData } from "@/components/dorms/dorm-card";
import { API_URL } from "@/lib/utils";

export function DormSearchClient({
  initialDorms,
  initialParams,
}: {
  initialDorms: DormCardData[];
  initialParams: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [dorms, setDorms] = useState(initialDorms);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState(initialParams.q ?? "");
  const [hasAC, setHasAC] = useState(initialParams.hasAC === "true");
  const [freshmanOnly, setFreshmanOnly] = useState(initialParams.freshmanOnly === "true");

  async function search() {
    setLoading(true);
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (hasAC) p.set("hasAC", "true");
    if (freshmanOnly) p.set("freshmanOnly", "true");
    router.push(`/dorms?${p}`);
    try {
      const res = await fetch(`${API_URL}/api/dorms/search?${p}`);
      const data = await res.json();
      setDorms(Array.isArray(data) ? data : data.items ?? data.dorms ?? []);
    } catch {
      setDorms([]);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-end">
        <Input placeholder="Dorm or college name" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hasAC} onChange={(e) => setHasAC(e.target.checked)} />
          Has AC
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={freshmanOnly} onChange={(e) => setFreshmanOnly(e.target.checked)} />
          Freshman friendly
        </label>
        <Button onClick={search} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </Button>
      </div>
      {dorms.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No dorms match your filters.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dorms.map((d) => (
            <DormCard key={d.id} dorm={d} />
          ))}
        </div>
      )}
    </div>
  );
}
