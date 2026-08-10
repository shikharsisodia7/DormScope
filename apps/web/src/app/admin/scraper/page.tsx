import { ScraperDashboard } from "@/components/admin/scraper-dashboard";
import { getRecentScrapeJobs } from "@/lib/admin-data";
import { requireAdminSession } from "@/lib/admin-auth";

export default async function ScraperAdminPage() {
  await requireAdminSession();
  const jobs = await getRecentScrapeJobs();

  return (
    <div className="site-container py-10 space-y-6">
      <h1 className="text-3xl font-bold">Scraper dashboard</h1>
      <p className="text-muted-foreground">
        Queue ingestion refreshes for the background worker. Playwright scraping does not run inside the web app.
      </p>
      <ScraperDashboard initialJobs={jobs} />
    </div>
  );
}
