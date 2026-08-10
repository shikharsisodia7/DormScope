import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getQualityDashboard } from "@/lib/admin-data";
import { requireAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function QualityPage() {
  await requireAdminSession();
  const data = await getQualityDashboard();

  return (
    <div className="site-container py-10 space-y-8">
      <h1 className="text-3xl font-bold">Data quality dashboard</h1>
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardDescription>Missing cost</CardDescription>
            <CardTitle>{data.missingCost}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Missing amenities</CardDescription>
            <CardTitle>{data.missingAmenities}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Low confidence (&lt;60%)</CardDescription>
            <CardTitle>{data.lowConfidence}</CardTitle>
          </CardHeader>
        </Card>
      </div>
      <div className="space-y-2">
        <h2 className="font-semibold text-lg">Coverage by college</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">College / State</th>
                <th className="py-2 pr-4 font-medium text-right">Dorms</th>
                <th className="py-2 pr-4 font-medium text-right">Avg completeness</th>
                <th className="py-2 font-medium text-right">Generated</th>
              </tr>
            </thead>
            <tbody>
              {data.reports.map((r) => (
                <tr key={r.id} className="border-b hover:bg-muted/30">
                  <td className="py-1.5 pr-4">{r.college?.name ?? r.state ?? "—"}</td>
                  <td className="py-1.5 pr-4 text-right">{r.totalDorms}</td>
                  <td className="py-1.5 pr-4 text-right">{Math.round(r.avgCompleteness * 100)}%</td>
                  <td className="py-1.5 text-right text-muted-foreground">
                    {r.generatedAt.toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
