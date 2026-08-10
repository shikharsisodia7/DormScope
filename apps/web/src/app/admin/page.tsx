import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminOverview } from "@/lib/admin-data";
import { requireAdminSession } from "@/lib/admin-auth";

export default async function AdminPage() {
  await requireAdminSession();
  const overview = await getAdminOverview();

  const stats = [
    { label: "Colleges", value: overview.colleges },
    { label: "Dorms", value: overview.dorms },
    { label: "Sources", value: overview.sources },
    { label: "Scrape success", value: `${overview.scrapeSuccessRate}%` },
    { label: "Avg confidence", value: `${overview.avgConfidence}%` },
    { label: "Missing cost", value: overview.missingCost },
    { label: "Missing amenities", value: overview.missingAmenities },
    { label: "Failed jobs", value: overview.failedJobs },
  ];

  return (
    <div className="site-container py-10 space-y-8">
      <h1 className="text-3xl font-bold">Admin dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader>
              <CardDescription>{s.label}</CardDescription>
              <CardTitle>{String(s.value ?? "—")}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className="flex gap-4">
        <Link href="/admin/scraper" className="text-primary hover:underline">Scraper dashboard →</Link>
        <Link href="/admin/quality" className="text-primary hover:underline">Data quality →</Link>
        <Link href="/api/admin/export" className="text-primary hover:underline">
          Export dataset
        </Link>
      </div>
      {overview.duplicateWarnings.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Duplicate warnings</CardTitle></CardHeader>
          <CardDescription>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              {overview.duplicateWarnings.map((d, i) => (
                <li key={i}>{d.a} ↔ {d.b}</li>
              ))}
            </ul>
          </CardDescription>
        </Card>
      )}
    </div>
  );
}
