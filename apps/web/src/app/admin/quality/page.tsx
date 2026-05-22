import { fetchApi } from "@/lib/utils";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export default async function QualityPage() {
  let data: { reports: { college?: { name: string }; state?: string; totalDorms: number; avgCompleteness: number }[]; missingCost: number; missingAmenities: number; lowConfidence: number } | null = null;
  try {
    data = await fetchApi("/api/analytics/quality");
  } catch {
    data = null;
  }

  return (
    <div className="container py-10 space-y-8">
      <h1 className="text-3xl font-bold">Data quality dashboard</h1>
      {data && (
        <>
          <div className="grid md:grid-cols-3 gap-4">
            <Card><CardHeader><CardTitle>Missing cost: {data.missingCost}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardTitle>Missing amenities: {data.missingAmenities}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardTitle>Low confidence: {data.lowConfidence}</CardTitle></CardHeader></Card>
          </div>
          <div className="space-y-2">
            <h2 className="font-semibold">Coverage by college</h2>
            {data.reports.map((r, i) => (
              <p key={i} className="text-sm text-muted-foreground">
                {r.college?.name ?? r.state} — {r.totalDorms} dorms, {Math.round(r.avgCompleteness * 100)}% complete
              </p>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
