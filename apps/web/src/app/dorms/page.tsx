import type { Metadata } from "next";
import { DormSearchClient } from "@/components/dorms/dorm-search-client";
import { searchDorms } from "@/lib/data";
import type { DormCardData } from "@/components/dorms/dorm-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search dorms",
  description: "Filter residence halls by amenities, cost, bathroom style, and more.",
};

export default async function DormsPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  let dorms: DormCardData[] = [];
  try {
    const rows = await searchDorms(searchParams);
    dorms = rows.map((d) => ({
      ...d,
      college: d.college,
    })) as DormCardData[];
  } catch {
    dorms = [];
  }

  return (
    <div className="site-container py-10 md:py-14">
      <h1 className="font-display text-3xl tracking-tight md:text-4xl">Search dorms</h1>
      <p className="mt-2 mb-8 text-muted-foreground">
        Filter by amenities, cost, bathroom style, and more. Only halls we have indexed appear here.
      </p>
      <DormSearchClient initialDorms={dorms} initialParams={searchParams} />
    </div>
  );
}
