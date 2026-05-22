"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function CollegeSearch() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [state, setState] = useState(sp.get("state") ?? "");

  function search() {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (state) p.set("state", state);
    router.push(`/colleges?${p}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Input placeholder="College name or city" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      <Input placeholder="State (e.g. CA)" value={state} onChange={(e) => setState(e.target.value)} className="w-24" />
      <Button onClick={search}>Search</Button>
    </div>
  );
}
