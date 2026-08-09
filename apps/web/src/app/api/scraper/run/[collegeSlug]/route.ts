import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError, handleRouteError, requireAdminKey } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Queues a scrape job. Long-running Playwright work must run via the scraper CLI
 * (`npm run scraper -- <college-slug>`), not inside Vercel serverless.
 */
export async function POST(req: Request, { params }: { params: { collegeSlug: string } }) {
  try {
    if (!requireAdminKey(req)) return jsonError("Unauthorized", 401);

    const college = await prisma.college.findUnique({ where: { slug: params.collegeSlug } });
    if (!college) return jsonError("College not found", 404);

    const job = await prisma.scrapeJob.create({
      data: {
        collegeId: college.id,
        status: "PENDING",
        candidateUrls: college.housingUrl ? [college.housingUrl] : [],
        stage: "queued",
      },
    });

    return jsonOk({
      message:
        "Job queued. Run `npm run scraper -- " +
        params.collegeSlug +
        "` (or scraper:ingest-sample) to process outside the web runtime.",
      jobId: job.id,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
