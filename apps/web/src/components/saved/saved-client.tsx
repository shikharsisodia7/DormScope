"use client";

import { useEffect, useState } from "react";
import { getGuestFavorites } from "@/lib/storage";
import { API_URL } from "@/lib/utils";
import { DormCard, type DormCardData } from "@/components/dorms/dorm-card";
import { Button } from "@/components/ui/button";

export function SavedClient() {
  const [dorms, setDorms] = useState<DormCardData[]>([]);

  useEffect(() => {
    const ids = getGuestFavorites();
    if (!ids.length) return;
    Promise.all(
      ids.map((id) =>
        fetch(`${API_URL}/api/dorms/search`).then((r) => r.json()).then((all: DormCardData[]) => all.find((d) => d.id === id))
      )
    ).then((found) => setDorms(found.filter(Boolean) as DormCardData[]));
  }, []);

  function exportJson() {
    const blob = new Blob([JSON.stringify(dorms, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "saved-dorms.json";
    a.click();
  }

  if (!dorms.length) return <p className="text-muted-foreground">No saved dorms yet.</p>;

  return (
    <div className="space-y-4">
      <Button variant="outline" onClick={exportJson}>Export JSON</Button>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dorms.map((d) => (
          <DormCard key={d.id} dorm={d} />
        ))}
      </div>
    </div>
  );
}
