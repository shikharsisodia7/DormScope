"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getGuestFavorites } from "@/lib/storage";
import { API_URL } from "@/lib/utils";
import { DormCard, type DormCardData } from "@/components/dorms/dorm-card";
import { Button } from "@/components/ui/button";

export function SavedClient() {
  const [dorms, setDorms] = useState<DormCardData[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const ids = getGuestFavorites();
    if (!ids.length) {
      setLoaded(true);
      return;
    }
    fetch(`${API_URL}/api/dorms/search?pageSize=100`)
      .then((r) => r.json())
      .then((all: DormCardData[] | { items?: DormCardData[]; dorms?: DormCardData[] }) => {
        const list = Array.isArray(all) ? all : all.items ?? all.dorms ?? [];
        setDorms(list.filter((d) => ids.includes(d.id)));
      })
      .finally(() => setLoaded(true));
  }, []);

  function exportJson() {
    const blob = new Blob([JSON.stringify(dorms, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "saved-dorms.json";
    a.click();
  }

  if (!loaded) return <p className="text-muted-foreground">Loading saved dorms…</p>;

  if (!dorms.length) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
        <p className="font-medium">No saved dorms yet.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Save halls from a dorm page to find them here later.
        </p>
        <Link href="/match" className="mt-6 inline-block">
          <Button>Find My Best Dorm</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="outline" onClick={exportJson}>
        Export JSON
      </Button>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {dorms.map((d) => (
          <DormCard key={d.id} dorm={d} />
        ))}
      </div>
    </div>
  );
}
