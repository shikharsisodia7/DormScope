import type { Metadata } from "next";
import { DormSearchClient } from "@/components/dorms/dorm-search-client";
import { fetchApi } from "@/lib/utils";
import type { DormCardData } from "@/components/dorms/dorm-card";

export const metadata: Metadata = {
  title: "Search dorms",
  description: "Filter residence halls by amenities, cost, bathroom style, and more.",
};

export default async function DormsPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([k, v]) => v && params.set(k, v));

  let dorms: DormCardData[] = [];
  try {
    const data = await fetchApi<DormCardData[] | { items?: DormCardData[]; dorms?: DormCardData[] }>(
      `/api/dorms/search?${params}`,
      { cache: "no-store" }
    );
    dorms = Array.isArray(data) ? data : data.items ?? data.dorms ?? [];
  } catch {
    dorms = [];
  }

  return (
    <div className="site-container py-10 md:py-14">
      <h1 className="font-display text-3xl tracking-tight md:text-4xl">Search dorms</h1>
      <p className="mt-2 mb-8 text-muted-foreground">
        Filter by amenities, cost, bathroom style, and more.
      </p>
      <DormSearchClient initialDorms={dorms} initialParams={searchParams} />
    </div>
  );
}
