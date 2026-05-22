import { DormSearchClient } from "@/components/dorms/dorm-search-client";
import { fetchApi } from "@/lib/utils";
import type { DormCardData } from "@/components/dorms/dorm-card";

export default async function DormsPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([k, v]) => v && params.set(k, v));

  let dorms: DormCardData[] = [];
  try {
    dorms = await fetchApi<DormCardData[]>(`/api/dorms/search?${params}`);
  } catch {
    dorms = [];
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-2">Dorm search</h1>
      <p className="text-muted-foreground mb-8">Filter by amenities, cost, bathroom style, and more.</p>
      <DormSearchClient initialDorms={dorms} initialParams={searchParams} />
    </div>
  );
}
