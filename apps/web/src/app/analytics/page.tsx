import { AnalyticsCharts } from "@/components/analytics/analytics-charts";
import { fetchApi } from "@/lib/utils";

export default async function AnalyticsPage() {
  let data: Record<string, unknown> | null = null;
  try {
    data = await fetchApi<Record<string, unknown>>("/api/analytics/national");
  } catch {
    data = null;
  }

  return (
    <div className="container py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">National dorm analytics</h1>
        <p className="text-muted-foreground mt-2">Trends across indexed U.S. college housing data.</p>
      </div>
      {data ? <AnalyticsCharts data={data} /> : (
        <p className="text-muted-foreground">Connect API and seed database to view analytics.</p>
      )}
    </div>
  );
}
