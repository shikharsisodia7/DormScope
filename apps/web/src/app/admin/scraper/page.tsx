import { ScraperDashboard } from "@/components/admin/scraper-dashboard";
import { fetchApi } from "@/lib/utils";

export default async function ScraperAdminPage() {
  let jobs: unknown[] = [];
  try {
    jobs = await fetchApi("/api/scraper/jobs");
  } catch {
    jobs = [];
  }

  return (
    <div className="site-container py-10 space-y-6">
      <h1 className="text-3xl font-bold">Scraper dashboard</h1>
      <p className="text-muted-foreground">Run scrapes, review logs, approve sources, verify dorms.</p>
      <ScraperDashboard initialJobs={jobs as never[]} />
    </div>
  );
}
