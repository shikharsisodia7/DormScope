"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { API_URL, cn } from "@/lib/utils";

interface CollegeHit {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  dormCount?: number;
  _count?: { dorms: number };
}

export function HomeSearch({ className }: { className?: string }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<CollegeHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const router = useRouter();
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/colleges?q=${encodeURIComponent(q.trim())}&pageSize=8`);
        if (!res.ok) return;
        const data = await res.json();
        const items: CollegeHit[] = Array.isArray(data) ? data : data.items ?? data.colleges ?? [];
        setHits(items);
        setOpen(true);
        setActive(0);
      } catch {
        setHits([]);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function goCollege(slug: string) {
    router.push(`/colleges/${slug}`);
    setOpen(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (hits[active]) {
      goCollege(hits[active].slug);
      return;
    }
    if (q.trim()) router.push(`/colleges?q=${encodeURIComponent(q.trim())}`);
    else router.push("/colleges");
  }

  return (
    <div ref={wrapRef} className={cn("relative w-full max-w-xl mx-auto", className)}>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-stretch" role="search">
        <div className="search-underline relative flex-1 rounded-md border border-border bg-card shadow-sm">
          <label htmlFor="college-search" className="sr-only">
            Search for your college
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="college-search"
            className="h-12 border-0 bg-transparent pl-10 text-base shadow-none focus-visible:ring-0"
            placeholder="Search your college…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => hits.length && setOpen(true)}
            autoComplete="off"
            role="combobox"
            aria-expanded={open && hits.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
          />
        </div>
        <Button type="submit" size="lg" className="h-12 px-7 shrink-0">
          Search
        </Button>
      </form>

      {open && hits.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-2 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg"
        >
          {hits.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col items-start px-4 py-3 text-left text-sm transition-colors hover:bg-accent",
                  i === active && "bg-accent"
                )}
                onMouseEnter={() => setActive(i)}
                onClick={() => goCollege(c.slug)}
              >
                <span className="font-medium text-foreground">{c.name}</span>
                <span className="text-muted-foreground">
                  {c.city}, {c.state}
                  {(c.dormCount ?? c._count?.dorms) != null
                    ? ` · ${c.dormCount ?? c._count?.dorms} halls`
                    : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
