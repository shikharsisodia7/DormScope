/**
 * Resumable nationwide housing ingestion with atomic IngestCheckpoint claims.
 *
 * MODE=nationwide|discovery|partial|retry|blocked|state|slugs|stale|validate
 * Optional: STATE SLUGS LIMIT OFFSET CONCURRENCY MIN_ENROLLMENT MAX_ENROLLMENT
 *           COVERAGE_STATUS STALE_DAYS WORKER_ID
 *
 * Targeting is coverage/inventory-state based — NOT "large .edu with zero dorms".
 * MIN_ENROLLMENT is prioritization only, not an exclusion gate (unless STRICT_ENROLLMENT=1).
 */
import { prisma, HousingCoverageStatus } from "@dormscope/database";
import { runScraperForCollege } from "../src/jobs/runScraper.js";
import { randomUUID } from "crypto";

const MODE = process.env.MODE ?? "nationwide";
const MIN_ENROLLMENT = process.env.MIN_ENROLLMENT
  ? Number(process.env.MIN_ENROLLMENT)
  : undefined;
const MAX_ENROLLMENT = process.env.MAX_ENROLLMENT
  ? Number(process.env.MAX_ENROLLMENT)
  : undefined;
const STRICT_ENROLLMENT = process.env.STRICT_ENROLLMENT === "1";
const LIMIT = Number(process.env.LIMIT ?? 50);
const OFFSET = Number(process.env.OFFSET ?? 0);
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY ?? 2));
const STATE = process.env.STATE?.toUpperCase();
const COVERAGE_STATUS = process.env.COVERAGE_STATUS;
const STALE_DAYS = Number(process.env.STALE_DAYS ?? 30);
const SLUGS = (process.env.SLUGS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const WORKER_ID = process.env.WORKER_ID ?? `local-${randomUUID().slice(0, 8)}`;
const LOCK_TTL_MS = Number(process.env.LOCK_TTL_MS ?? 30 * 60 * 1000);
const BLOCKED_COOLDOWN_MS = Number(process.env.BLOCKED_COOLDOWN_MS ?? 7 * 24 * 60 * 60 * 1000);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const ONLINE_EXCLUSIONS = {
  OR: [
    { name: { contains: "Phoenix", mode: "insensitive" as const } },
    { name: { contains: "Western Governors", mode: "insensitive" as const } },
    { name: { contains: "Online", mode: "insensitive" as const } },
    { name: { contains: "Beauty", mode: "insensitive" as const } },
    { name: { contains: "Cosmetology", mode: "insensitive" as const } },
  ],
};

function enrollmentWhere() {
  if (MIN_ENROLLMENT == null && MAX_ENROLLMENT == null) return {};
  if (STRICT_ENROLLMENT) {
    return {
      studentPopulation: {
        ...(MIN_ENROLLMENT != null ? { gte: MIN_ENROLLMENT } : {}),
        ...(MAX_ENROLLMENT != null ? { lte: MAX_ENROLLMENT } : {}),
      },
    };
  }
  // Soft prioritization: still include null enrollment / small schools
  return {};
}

async function loadTargets() {
  if (MODE === "slugs" || SLUGS.length) {
    return prisma.college.findMany({
      where: { slug: { in: SLUGS.length ? SLUGS : ["__none__"] } },
      select: { id: true, slug: true, name: true, studentPopulation: true, housingCoverageStatus: true },
      orderBy: [{ slug: "asc" }],
    });
  }

  if (MODE === "state" || STATE) {
    return prisma.college.findMany({
      where: {
        state: STATE ?? undefined,
        housingCoverageStatus: {
          in: [
            HousingCoverageStatus.DISCOVERY_PENDING,
            HousingCoverageStatus.SITE_FOUND,
            HousingCoverageStatus.DIRECTORY_PENDING,
            HousingCoverageStatus.PARTIAL,
            HousingCoverageStatus.RETRYABLE,
            HousingCoverageStatus.UNKNOWN,
          ],
        },
        NOT: ONLINE_EXCLUSIONS,
        ...enrollmentWhere(),
      },
      orderBy: [{ housingCoverageStatus: "asc" }, { studentPopulation: "desc" }, { slug: "asc" }],
      skip: OFFSET,
      take: LIMIT,
      select: { id: true, slug: true, name: true, studentPopulation: true, housingCoverageStatus: true },
    });
  }

  if (MODE === "blocked") {
    const cps = await prisma.ingestCheckpoint.findMany({
      where: {
        status: "blocked",
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
      },
      take: LIMIT,
      orderBy: { updatedAt: "asc" },
      select: { collegeId: true },
    });
    return prisma.college.findMany({
      where: { id: { in: cps.map((c) => c.collegeId) } },
      select: { id: true, slug: true, name: true, studentPopulation: true, housingCoverageStatus: true },
      orderBy: [{ slug: "asc" }],
    });
  }

  if (MODE === "retry") {
    const cps = await prisma.ingestCheckpoint.findMany({
      where: {
        OR: [
          { status: "retryable" },
          { status: "failed", nextRetryAt: { lte: new Date() } },
          { status: "pending", stage: "queued" },
        ],
        NOT: { status: "blocked" },
      },
      take: LIMIT,
      orderBy: { updatedAt: "asc" },
      select: { collegeId: true },
    });
    return prisma.college.findMany({
      where: { id: { in: cps.map((c) => c.collegeId) } },
      select: { id: true, slug: true, name: true, studentPopulation: true, housingCoverageStatus: true },
      orderBy: [{ slug: "asc" }],
    });
  }

  if (MODE === "stale") {
    const staleBefore = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);
    return prisma.college.findMany({
      where: {
        housingCoverageStatus: {
          in: [HousingCoverageStatus.PARTIAL, HousingCoverageStatus.COMPLETE],
        },
        OR: [{ lastInventorySuccessAt: null }, { lastInventorySuccessAt: { lt: staleBefore } }],
        NOT: ONLINE_EXCLUSIONS,
      },
      orderBy: [{ lastInventorySuccessAt: "asc" }, { slug: "asc" }],
      skip: OFFSET,
      take: LIMIT,
      select: { id: true, slug: true, name: true, studentPopulation: true, housingCoverageStatus: true },
    });
  }

  if (MODE === "partial") {
    return prisma.college.findMany({
      where: {
        housingCoverageStatus: HousingCoverageStatus.PARTIAL,
        NOT: ONLINE_EXCLUSIONS,
        ...(COVERAGE_STATUS
          ? { housingCoverageStatus: COVERAGE_STATUS as HousingCoverageStatus }
          : {}),
      },
      orderBy: [{ lastInventorySuccessAt: "asc" }, { slug: "asc" }],
      skip: OFFSET,
      take: LIMIT,
      select: { id: true, slug: true, name: true, studentPopulation: true, housingCoverageStatus: true },
    });
  }

  // nationwide | discovery | validate — coverage-state targeting
  const statuses: HousingCoverageStatus[] =
    MODE === "discovery"
      ? [HousingCoverageStatus.DISCOVERY_PENDING, HousingCoverageStatus.UNKNOWN]
      : MODE === "validate"
        ? [HousingCoverageStatus.PARTIAL, HousingCoverageStatus.SITE_FOUND, HousingCoverageStatus.DIRECTORY_PENDING]
        : [
            HousingCoverageStatus.DISCOVERY_PENDING,
            HousingCoverageStatus.SITE_FOUND,
            HousingCoverageStatus.DIRECTORY_PENDING,
            HousingCoverageStatus.PARTIAL,
            HousingCoverageStatus.RETRYABLE,
            HousingCoverageStatus.UNKNOWN,
          ];

  const statusFilter = COVERAGE_STATUS
    ? [COVERAGE_STATUS as HousingCoverageStatus]
    : statuses;

  // Deterministic ordering by slug after coverage — prevents always picking same top schools
  const colleges = await prisma.college.findMany({
    where: {
      housingCoverageStatus: { in: statusFilter },
      ...(STATE ? { state: STATE } : {}),
      NOT: ONLINE_EXCLUSIONS,
      // Do not require .edu — accredited schools may use other domains
      // Do not require dorms:none — incomplete inventories still need work
      // Skip active locks
      OR: [
        { ingestCheckpoint: null },
        {
          ingestCheckpoint: {
            OR: [
              { lockedAt: null },
              { lockedAt: { lt: new Date(Date.now() - LOCK_TTL_MS) } },
              { status: { in: ["pending", "retryable", "failed", "partial", "queued"] } },
            ],
          },
        },
      ],
    },
    orderBy: [
      { housingCoverageStatus: "asc" },
      // Soft prefer larger schools when MIN_ENROLLMENT set, but include all
      { studentPopulation: "desc" },
      { slug: "asc" },
    ],
    skip: OFFSET,
    take: LIMIT * 3, // over-fetch then soft-filter enrollment for prioritization
    select: { id: true, slug: true, name: true, studentPopulation: true, housingCoverageStatus: true },
  });

  let filtered = colleges;
  if (MIN_ENROLLMENT != null && !STRICT_ENROLLMENT) {
    // Prefer meeting min enrollment but allow smaller schools to fill remaining slots
    const preferred = colleges.filter(
      (c) => c.studentPopulation == null || c.studentPopulation >= MIN_ENROLLMENT
    );
    const rest = colleges.filter(
      (c) => c.studentPopulation != null && c.studentPopulation < MIN_ENROLLMENT
    );
    filtered = [...preferred, ...rest];
  }
  if (MAX_ENROLLMENT != null && STRICT_ENROLLMENT) {
    filtered = filtered.filter(
      (c) => c.studentPopulation == null || c.studentPopulation <= MAX_ENROLLMENT
    );
  }
  return filtered.slice(0, LIMIT);
}

/**
 * Atomic claim: updateMany only if unlocked or lock expired.
 * Returns true only when this worker uniquely claimed the row.
 */
async function claimCollege(collegeId: string): Promise<boolean> {
  const expiredBefore = new Date(Date.now() - LOCK_TTL_MS);
  const now = new Date();

  // Ensure checkpoint row exists
  await prisma.ingestCheckpoint.upsert({
    where: { collegeId },
    create: {
      collegeId,
      status: "pending",
      stage: "queued",
    },
    update: {},
  });

  const result = await prisma.ingestCheckpoint.updateMany({
    where: {
      collegeId,
      OR: [
        { lockedAt: null },
        { lockedAt: { lt: expiredBefore } },
        {
          AND: [
            { lockOwner: WORKER_ID },
            { status: { in: ["pending", "queued", "retryable"] } },
          ],
        },
      ],
      NOT: {
        AND: [{ status: "running" }, { lockedAt: { gte: expiredBefore } }],
      },
    },
    data: {
      status: "running",
      stage: "queued",
      lockedAt: now,
      lockOwner: WORKER_ID,
      lastError: null,
    },
  });

  if (result.count !== 1) return false;

  // Verify ownership
  const cp = await prisma.ingestCheckpoint.findUnique({ where: { collegeId } });
  return cp?.lockOwner === WORKER_ID && cp.status === "running";
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
  console.log(
    JSON.stringify(
      {
        mode: MODE,
        worker: WORKER_ID,
        targets: targets.length,
        minEnrollment: MIN_ENROLLMENT ?? null,
        limit: LIMIT,
        concurrency: CONCURRENCY,
        state: STATE ?? null,
      },
      null,
      2
    )
  );

  let ok = 0;
  let withHalls = 0;
  let failed = 0;
  let skippedLock = 0;
  let totalUnique = 0;
  let created = 0;
  let updated = 0;

  const scrapeMode = MODE === "discovery" ? "discovery" : "full";

  await mapPool(targets, CONCURRENCY, async (college, index) => {
    const label = `[${index + 1}/${targets.length}] ${college.slug}`;
    const claimed = await claimCollege(college.id);
    if (!claimed) {
      skippedLock += 1;
      console.log(`${label} → skipped (lock)`);
      return;
    }

    try {
      const result = await runScraperForCollege(college.slug, {
        workerId: WORKER_ID,
        mode: scrapeMode,
      });
      ok += 1;
      totalUnique += result.uniqueEntitiesSeenThisRun;
      created += result.newEntitiesCreated;
      updated += result.existingEntitiesUpdated;
      if (result.uniqueEntitiesSeenThisRun > 0) withHalls += 1;
      console.log(
        `${label} → unique=${result.uniqueEntitiesSeenThisRun} created=${result.newEntitiesCreated} updated=${result.existingEntitiesUpdated} (${result.coverage})`
      );
    } catch (err) {
      failed += 1;
      console.error(`${label} ERROR: ${(err as Error).message}`);
      const isBlocked = /403|401|access restricted/i.test((err as Error).message);
      await prisma.ingestCheckpoint.update({
        where: { collegeId: college.id },
        data: {
          status: isBlocked ? "blocked" : "retryable",
          lastError: (err as Error).message,
          retryCount: { increment: 1 },
          nextRetryAt: new Date(
            Date.now() + (isBlocked ? BLOCKED_COOLDOWN_MS : 60 * 60 * 1000)
          ),
          lockedAt: null,
          lockOwner: null,
          failureClass: isBlocked ? "access_restricted" : "error",
        },
      });
    }
    await sleep(120);
  });

  const collegesWithDorms = await prisma.college.count({
    where: { dorms: { some: { isActive: true } } },
  });
  const dormRows = await prisma.dorm.count({ where: { isActive: true } });
  console.log(
    JSON.stringify(
      {
        processed: targets.length,
        ok,
        withHalls,
        failed,
        skippedLock,
        totalUniqueThisRun: totalUnique,
        created,
        updated,
        collegesWithDorms,
        dormRows,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
