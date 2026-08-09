/**
 * Resumable nationwide housing ingestion with IngestCheckpoint locking.
 *
 * Commands via env:
 *   MODE=nationwide|retry|slugs|state|discovery
 *   SLUGS=a,b,c
 *   STATE=CA
 *   MIN_ENROLLMENT=3000 LIMIT=200 CONCURRENCY=3 OFFSET=0
 *   ONLY_WITHOUT_DORMS=1
 */
import { prisma } from "@dormscope/database";
import { runScraperForCollege } from "../src/jobs/runScraper.js";
import { randomUUID } from "crypto";

const MODE = process.env.MODE ?? "nationwide";
const MIN_ENROLLMENT = Number(process.env.MIN_ENROLLMENT ?? 3000);
const LIMIT = Number(process.env.LIMIT ?? 200);
const OFFSET = Number(process.env.OFFSET ?? 0);
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY ?? 3));
const ONLY_WITHOUT_DORMS = process.env.ONLY_WITHOUT_DORMS !== "0";
const STATE = process.env.STATE?.toUpperCase();
const SLUGS = (process.env.SLUGS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const WORKER_ID = process.env.WORKER_ID ?? `local-${randomUUID().slice(0, 8)}`;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function loadTargets() {
  if (MODE === "slugs" || SLUGS.length) {
    return prisma.college.findMany({
      where: { slug: { in: SLUGS.length ? SLUGS : ["__none__"] } },
      select: { id: true, slug: true, name: true, studentPopulation: true },
    });
  }

  if (MODE === "retry") {
    const cps = await prisma.ingestCheckpoint.findMany({
      where: {
        OR: [
          { status: "retryable" },
          { status: "failed", nextRetryAt: { lte: new Date() } },
          { status: "blocked" },
        ],
      },
      take: LIMIT,
      orderBy: { updatedAt: "asc" },
      select: { collegeId: true },
    });
    return prisma.college.findMany({
      where: { id: { in: cps.map((c) => c.collegeId) } },
      select: { id: true, slug: true, name: true, studentPopulation: true },
    });
  }

  return prisma.college.findMany({
    where: {
      websiteUrl: { contains: ".edu" },
      studentPopulation: { gte: MIN_ENROLLMENT },
      ...(STATE ? { state: STATE } : {}),
      ...(ONLY_WITHOUT_DORMS ? { dorms: { none: {} } } : {}),
      NOT: {
        OR: [
          { name: { contains: "Phoenix", mode: "insensitive" } },
          { name: { contains: "Western Governors", mode: "insensitive" } },
          { name: { contains: "Online", mode: "insensitive" } },
          { name: { contains: "Beauty", mode: "insensitive" } },
          { name: { contains: "Cosmetology", mode: "insensitive" } },
        ],
      },
      // Skip colleges currently locked by another worker
      OR: [
        { ingestCheckpoint: null },
        {
          ingestCheckpoint: {
            OR: [
              { lockedAt: null },
              { lockedAt: { lt: new Date(Date.now() - 30 * 60 * 1000) } },
              { status: { in: ["pending", "retryable", "failed"] } },
            ],
          },
        },
      ],
    },
    orderBy: [{ studentPopulation: "desc" }],
    skip: OFFSET,
    take: LIMIT,
    select: { id: true, slug: true, name: true, studentPopulation: true },
  });
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T, i: number) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, () => worker()));
  return results;
}

async function main() {
  const targets = await loadTargets();
  console.log(JSON.stringify({ mode: MODE, worker: WORKER_ID, targets: targets.length, minEnrollment: MIN_ENROLLMENT, limit: LIMIT, concurrency: CONCURRENCY }, null, 2));

  let ok = 0;
  let withHalls = 0;
  let failed = 0;
  let totalHalls = 0;

  await mapPool(targets, CONCURRENCY, async (college, index) => {
    const label = `[${index + 1}/${targets.length}] ${college.slug}`;
    try {
      // Optimistic lock
      await prisma.ingestCheckpoint.upsert({
        where: { collegeId: college.id },
        create: {
          collegeId: college.id,
          status: "running",
          stage: "queued",
          lockedAt: new Date(),
          lockOwner: WORKER_ID,
        },
        update: {
          status: "running",
          lockedAt: new Date(),
          lockOwner: WORKER_ID,
        },
      });

      const result = await runScraperForCollege(college.slug);
      ok += 1;
      totalHalls += result.dormsFound;
      if (result.dormsFound > 0) withHalls += 1;
      console.log(`${label} → ${result.dormsFound} halls (${result.coverage})`);
    } catch (err) {
      failed += 1;
      console.error(`${label} ERROR: ${(err as Error).message}`);
      await prisma.ingestCheckpoint.upsert({
        where: { collegeId: college.id },
        create: {
          collegeId: college.id,
          status: "retryable",
          stage: "discover",
          lastError: (err as Error).message,
          retryCount: 1,
          nextRetryAt: new Date(Date.now() + 60 * 60 * 1000),
        },
        update: {
          status: "retryable",
          lastError: (err as Error).message,
          retryCount: { increment: 1 },
          nextRetryAt: new Date(Date.now() + 60 * 60 * 1000),
          lockedAt: null,
          lockOwner: null,
        },
      });
    }
    await sleep(120);
  });

  const collegesWithDorms = await prisma.college.count({ where: { dorms: { some: {} } } });
  const dormRows = await prisma.dorm.count();
  console.log(JSON.stringify({ processed: targets.length, ok, withHalls, failed, totalHallsThisRun: totalHalls, collegesWithDorms, dormRows }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
