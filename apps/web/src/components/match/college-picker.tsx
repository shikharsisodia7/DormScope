"use client";

import { useEffect, useId, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { API_URL } from "@/lib/utils";

export interface CollegeOption {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  dormCount?: number;
}

export function CollegePicker({
  value,
  onSelect,
  onClear,
  preselectedSlug,
}: {
  value: CollegeOption | null;
  onSelect: (c: CollegeOption) => void;
  onClear: () => void;
  preselectedSlug?: string;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<CollegeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listId = useId();

  useEffect(() => {
    if (!preselectedSlug || value) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/colleges/${preselectedSlug}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          onSelect({
            id: data.id,
            name: data.name,
            slug: data.slug,
            city: data.city,
            state: data.state,
            dormCount: data.dormCount ?? data.dorms?.length,
          });
          setQ(data.name);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preselectedSlug, value, onSelect]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    if (value && q === value.name) return;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/api/colleges?q=${encodeURIComponent(q.trim())}&pageSize=10`);
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        const items = (Array.isArray(data) ? data : data.items ?? data.colleges ?? []).map(
          (c: CollegeOption & { _count?: { dorms: number } }) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            city: c.city,
            state: c.state,
            dormCount: c.dormCount ?? c._count?.dorms,
          })
        );
        setHits(items);
      } catch {
        setError("Could not search colleges. Try again.");
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q, value]);

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="match-college" className="text-sm font-medium">
          Your college <span className="text-destructive">*</span>
        </label>
        <p className="mt-1 text-sm text-muted-foreground">Required. Rankings are scoped to one school.</p>
      </div>
      <div className="search-underline relative rounded-md border border-border bg-card">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id="match-college"
          className="h-12 border-0 bg-transparent pl-10 shadow-none focus-visible:ring-0"
          placeholder="Start typing a college name…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (value) onClear();
          }}
          role="combobox"
          aria-expanded={hits.length > 0}
          aria-controls={listId}
          autoComplete="off"
        />
      </div>
      {loading && <p className="text-sm text-muted-foreground">Searching…</p>}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {hits.length > 0 && (
        <ul id={listId} role="listbox" className="overflow-hidden rounded-lg border border-border bg-card">
          {hits.map((c) => (
            <li key={c.id} role="option" aria-selected={false}>
              <button
                type="button"
                className="flex w-full flex-col items-start px-4 py-3 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                onClick={() => {
                  onSelect(c);
                  setQ(c.name);
                  setHits([]);
                }}
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">
                  {c.city}, {c.state}
                  {c.dormCount != null ? ` · ${c.dormCount} halls` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {value && (
        <p className="rounded-md bg-accent/60 px-3 py-2 text-sm">
          Selected: <strong>{value.name}</strong> ({value.city}, {value.state})
        </p>
      )}
    </div>
  );
}
