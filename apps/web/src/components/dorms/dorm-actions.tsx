"use client";

import { Button } from "@/components/ui/button";
import { toggleGuestFavorite, getCompareIds, setCompareIds } from "@/lib/storage";
import { useState } from "react";

export function DormActions({ dormId }: { dormId: string; dormName?: string }) {
  const [saved, setSaved] = useState(false);
  const [added, setAdded] = useState(false);

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        onClick={() => {
          toggleGuestFavorite(dormId);
          setSaved(!saved);
        }}
      >
        {saved ? "Saved ✓" : "Save dorm"}
      </Button>
      <Button
        variant="secondary"
        onClick={() => {
          const ids = getCompareIds();
          if (!ids.includes(dormId)) setCompareIds([...ids, dormId]);
          setAdded(true);
        }}
      >
        {added ? "Added to compare" : "Add to compare"}
      </Button>
    </div>
  );
}
