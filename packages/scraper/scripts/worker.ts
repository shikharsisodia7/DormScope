/**
 * Long-running ingest worker: atomically claims IngestCheckpoint rows and runs scraper jobs.
 *
 * Env:
 *   ONE_SHOT=1       — exit after one claim cycle (no new claims when idle)
 *   MAX_JOBS         — max colleges to process (default unlimited)
 *   CONCURRENCY      — parallel scrape workers (default 1)
 *   WORKER_ID        — lock owner id (default local-<uuid>)
 *   LOCK_TTL_MS      — stale lock reclaim threshold (default 30m)
 *   BLOCKED_COOLDOWN_MS — retry delay for blocked sites (default 7d)
 */
import { prisma } from "@dormscope/database";
import { runScraperForCollege } from "../src/jobs/runScraper.js";
import { randomUUID } from "crypto";

const ONE_SHOT = process.env.ONE_SHOT === "1";
const MAX_JOBS =
  process.env.MAX_JOBS != null && process.env.MAX_JOBS !== ""
    ? Math.max(1, Number(process.env.MAX_JOBS))
    : Infinity;
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY ?? 1));
const WORKER_ID = process.env.WORKER_ID ?? `worker-${randomUUID().slice(0, 8)}`;
const LOCK_TTL_MS = Number(process.env.LOCK_TTL_MS ?? 30 * 60 * 1000);
const BLOCKED_COOLDOWN_MS = Number(process.env.BLOCKED_COOLDOWN_MS ?? 7 * 24 * 60 * 60 * 1000);
const POLL_MS = Number(process.env.POLL_MS ?? 2000);

let shuttingDown = false;
let inFlight = 0;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isClaimableStatus(status: string): boolean {
  return status === "pending" || status === "queued" || status === "retryable" || status === "failed";
}

/**
 * Atomic claim: updateMany only if unlocked or lock expired.
 * Returns college slug when this worker uniquely claimed the row.
 */
async function claimNextCheckpoint(): Promise<{ collegeId: string; slug: string } | null> {
  if (shuttingDown) return null;

  const expiredBefore = new Date(Date.now() - LOCK_TTL_MS);
  const now = new Date();

  const candidates = await prisma.ingestCheckpoint.findMany({
    where: {
      status: { in: ["pending", "queued", "retryable", "failed"] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      AND: [
        {
          OR: [{ lockedAt: null }, { lockedAt: { lt: expiredBefore } }],
        },
        {
          NOT: {
            AND: [{ status: "running" }, { lockedAt: { gte: expiredBefore } }],
          },
        },
      ],
    },
    orderBy: { updatedAt: "asc" },
    take: 10,
    include: { college: { select: { id: true, slug: true } } },
  });

  for (const cp of candidates) {
    if (!isClaimableStatus(cp.status)) continue;

    const result = await prisma.ingestCheckpoint.updateMany({
      where: {
        collegeId: cp.collegeId,
        status: { in: ["pending", "queued", "retryable", "failed"] },
        AND: [
          { OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] },
          {
            OR: [
              { lockedAt: null },
              { lockedAt: { lt: expiredBefore } },
              {
                AND: [
                  { lockOwner: WORKER_ID },
                  { status: { in: ["pending", "queued", "retryable", "failed"] } },
                ],
              },
            ],
          },
          {
            NOT: {
              AND: [{ status: "running" }, { lockedAt: { gte: expiredBefore } }],
            },
          },
        ],
      },
      data: {
        status: "running",
        stage: "queued",
        lockedAt: now,
        lockOwner: WORKER_ID,
        lastError: null,
      },
    });

    if (result.count !== 1) continue;

    const verified = await prisma.ingestCheckpoint.findUnique({
      where: { collegeId: cp.collegeId },
    });
    if (verified?.lockOwner === WORKER_ID && verified.status === "running") {
      return { collegeId: cp.collegeId, slug: cp.college.slug };
    }
  }

  return null;
}

async function processJob(collegeId: string, slug: string, jobNum: number): Promise<void> {
  inFlight += 1;
  const label = `[${jobNum}] ${slug}`;
  try {
    const result = await runScraperForCollege(slug, { workerId: WORKER_ID });
    console.log(
      `${label} → unique=${result.uniqueEntitiesSeenThisRun} created=${result.newEntitiesCreated} updated=${result.existingEntitiesUpdated} (${result.coverage})`
    );
  } catch (err) {
    console.error(`${label} ERROR: ${(err as Error).message}`);
    const isBlocked = /403|401|access restricted/i.test((err as Error).message);
    await prisma.ingestCheckpoint.update({
      where: { collegeId },
      data: {
        status: isBlocked ? "blocked" : "retryable",
        lastError: (err as Error).message,
        retryCount: { increment: 1 },
        nextRetryAt: new Date(Date.now() + (isBlocked ? BLOCKED_COOLDOWN_MS : 60 * 60 * 1000)),
        lockedAt: null,
        lockOwner: null,
        failureClass: isBlocked ? "access_restricted" : "error",
      },
    });
  } finally {
    inFlight -= 1;
  }
}

async function workerLoop(processed: { count: number }): Promise<void> {
  while (!shuttingDown && processed.count < MAX_JOBS) {
    const claimed = await claimNextCheckpoint();
    if (!claimed) {
      if (ONE_SHOT || shuttingDown) break;
      await sleep(POLL_MS);
      continue;
    }

    processed.count += 1;
    await processJob(claimed.collegeId, claimed.slug, processed.count);

    if (ONE_SHOT) break;
    await sleep(120);
  }
}

async function main() {
  console.log(
    JSON.stringify(
      {
        worker: WORKER_ID,
        oneShot: ONE_SHOT,
        maxJobs: Number.isFinite(MAX_JOBS) ? MAX_JOBS : null,
        concurrency: CONCURRENCY,
      },
      null,
      2
    )
  );

  const processed = { count: 0 };

  process.on("SIGINT", () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("\nSIGINT received — finishing in-flight jobs, no new claims...");
  });

  process.on("SIGTERM", () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("\nSIGTERM received — finishing in-flight jobs, no new claims...");
  });

  const loops = Array.from({ length: CONCURRENCY }, () => workerLoop(processed));
  await Promise.all(loops);

  while (inFlight > 0) {
    await sleep(200);
  }

  console.log(JSON.stringify({ processed: processed.count, worker: WORKER_ID }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
