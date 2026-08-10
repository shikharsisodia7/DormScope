import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Queues an ingest refresh via IngestCheckpoint. Long-running Playwright work runs
 * in the scraper CLI/worker — not inside Vercel serverless.
 */
export async function POST(req: Request, { params }: { params: { collegeSlug: string } }) {
  try {
    if (!(await requireAdminAuth(req))) return jsonError("Unauthorized", 401);

    const college = await prisma.college.findUnique({ where: { slug: params.collegeSlug } });
    if (!college) return jsonError("College not found", 404);

    const checkpoint = await prisma.ingestCheckpoint.upsert({
      where: { collegeId: college.id },
      create: {
        collegeId: college.id,
        stage: "queued",
        status: "pending",
        candidateUrls: college.housingUrl ? [college.housingUrl] : [],
        metadata: { queuedBy: "admin-ui", queuedAt: new Date().toISOString() },
      },
      update: {
        stage: "queued",
        status: "pending",
        candidateUrls: college.housingUrl ? [college.housingUrl] : [],
        lockedAt: null,
        lockOwner: null,
        nextRetryAt: null,
        lastError: null,
        metadata: { queuedBy: "admin-ui", queuedAt: new Date().toISOString() },
      },
    });

    return jsonOk({
      message:
        `Refresh queued for ${college.name}. The background worker will pick this up when you run ` +
        `\`npm run scraper -- ${params.collegeSlug}\` or the nationwide ingest worker.`,
      checkpointId: checkpoint.id,
      stage: checkpoint.stage,
      status: checkpoint.status,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
