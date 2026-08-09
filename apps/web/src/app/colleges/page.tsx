import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { CollegeSearch } from "@/components/colleges/college-search";
import { searchColleges } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Explore colleges",
  description: "Search U.S. colleges by name, city, or nickname and browse on-campus housing.",
};

async function CollegeList({ searchParams }: { searchParams: { q?: string; state?: string } }) {
  let colleges: Awaited<ReturnType<typeof searchColleges>> = [];
  try {
    colleges = await searchColleges({
      q: searchParams.q,
      state: searchParams.state,
      pageSize: 48,
    });
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
        const count = c.dormCount ?? 0;
        return (
          <li key={c.id}>
            <Link
              href={`/colleges/${c.slug}`}
              className="flex flex-col gap-1 py-5 transition-colors hover:text-primary sm:flex-row sm:items-baseline sm:justify-between"
            >
              <span className="font-display text-xl">{c.name}</span>
              <span className="text-sm text-muted-foreground">
                {c.city}, {c.state} · {count} hall{count === 1 ? "" : "s"}
                {count === 0 ? " · halls not indexed yet" : ""}
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
          Search by official name, short name, city, or common alias. Halls are listed when we have
          them — many schools are in the directory before residence halls are indexed.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading search…</p>}>
        <CollegeSearch />
      </Suspense>
      <CollegeList searchParams={searchParams} />
    </div>
  );
}
