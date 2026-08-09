import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { CollegeSearch } from "@/components/colleges/college-search";
import { fetchApi } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Explore colleges",
  description: "Search U.S. colleges by name, city, or nickname and browse on-campus housing.",
};

interface College {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  schoolType?: string;
  dormCount?: number;
  _count?: { dorms: number };
  aliases?: { alias: string }[];
}

async function CollegeList({ searchParams }: { searchParams: { q?: string; state?: string } }) {
  const params = new URLSearchParams();
  if (searchParams.q) params.set("q", searchParams.q);
  if (searchParams.state) params.set("state", searchParams.state);
  params.set("pageSize", "48");

  let colleges: College[] = [];
  try {
    const data = await fetchApi<College[] | { items?: College[]; colleges?: College[] }>(
      `/api/colleges?${params}`,
      { cache: "no-store" }
    );
    colleges = Array.isArray(data) ? data : data.items ?? data.colleges ?? [];
  } catch {
    colleges = [];
  }

  if (colleges.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-16 text-center">
        <p className="font-medium">No colleges match that search.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Try a nickname, city, or shorter name. Alias search is supported.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/70 border-y border-border/70">
      {colleges.map((c) => {
        const count = c.dormCount ?? c._count?.dorms ?? 0;
        return (
          <li key={c.id}>
            <Link
              href={`/colleges/${c.slug}`}
              className="flex flex-col gap-1 py-5 transition-colors hover:text-primary sm:flex-row sm:items-baseline sm:justify-between"
            >
              <span className="font-display text-xl">{c.name}</span>
              <span className="text-sm text-muted-foreground">
                {c.city}, {c.state} · {count} hall{count === 1 ? "" : "s"}
                {c.aliases?.[0] ? ` · also “${c.aliases[0].alias}”` : ""}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function CollegesPage({
  searchParams,
}: {
  searchParams: { q?: string; state?: string };
}) {
  return (
    <div className="site-container space-y-8 py-10 md:py-14">
      <div>
        <h1 className="font-display text-3xl tracking-tight md:text-4xl">Explore colleges</h1>
        <p className="mt-2 text-muted-foreground">
          Search by official name, short name, city, or common alias.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading search…</p>}>
        <CollegeSearch />
      </Suspense>
      <CollegeList searchParams={searchParams} />
    </div>
  );
}
