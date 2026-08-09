"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CollegeSearch() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [state, setState] = useState(sp.get("state") ?? "");

  function search(e?: React.FormEvent) {
    e?.preventDefault();
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (state.trim()) p.set("state", state.trim().toUpperCase());
    router.push(`/colleges?${p}`);
  }

  return (
    <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap" role="search">
      <div className="search-underline relative min-w-[min(100%,18rem)] flex-1 rounded-md border border-border bg-card">
        <label htmlFor="explore-q" className="sr-only">
          College name, city, or nickname
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id="explore-q"
          placeholder="Name, city, or alias (e.g. SCU, UMich)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
        />
      </div>
      <div>
        <label htmlFor="explore-state" className="sr-only">
          State
        </label>
        <Input
          id="explore-state"
          placeholder="State"
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="w-24"
          maxLength={2}
          aria-label="State abbreviation"
        />
      </div>
      <Button type="submit">Search</Button>
    </form>
  );
}
