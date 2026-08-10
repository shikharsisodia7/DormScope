/**
 * Shared helpers for integration tests and production use.
 *
 * - `recordFieldConflict` — create or update a FieldConflict when sources disagree.
 * - `mergeDorms`          — migrate reviews/sources from a duplicate dorm to its canonical.
 */
import type { PrismaClient, FieldConflict } from "@prisma/client";
import { FieldConflictStatus, DataQualityStatus } from "@prisma/client";

// ── FieldConflict ─────────────────────────────────────────────────────────────

export interface ConflictEntry {
  value: string | boolean | number | null;
  sourceId?: string | null;
  sourceUrl?: string | null;
  confidence?: number;
  recordedAt?: string;
}

export interface RecordFieldConflictOptions {
  dormId: string;
  fieldName: string;
  value: string | boolean | number | null;
  sourceId?: string | null;
  sourceUrl?: string | null;
  confidence?: number;
}

/**
 * Record a conflicting field value for a dorm.
 *
 * If an OPEN conflict already exists for this dorm+field:
 *   - Returns the existing conflict if this (value, sourceId) pair is already present.
 *   - Otherwise appends the new entry to the `values` JSON array.
 *
 * If no OPEN conflict exists, creates one.
 *
 * Export this from @dormscope/database so persistDorm can call it when two
 * sources report different values for the same field.
 */
export async function recordFieldConflict(
  prisma: PrismaClient,
  opts: RecordFieldConflictOptions
): Promise<FieldConflict> {
  const existing = await prisma.fieldConflict.findFirst({
    where: {
      dormId: opts.dormId,
      fieldName: opts.fieldName,
      status: FieldConflictStatus.OPEN,
    },
    orderBy: { createdAt: "desc" },
  });

  const entry: ConflictEntry = {
    value: opts.value,
    sourceId: opts.sourceId ?? null,
    sourceUrl: opts.sourceUrl ?? null,
    confidence: opts.confidence ?? 0.5,
    recordedAt: new Date().toISOString(),
  };

  if (existing) {
    const values = (existing.values as unknown as ConflictEntry[]) ?? [];

    // Already recorded this (value + sourceId) pair — skip
    const alreadyRecorded = values.some(
      (v) => v.value === opts.value && v.sourceId === (opts.sourceId ?? null)
    );
    if (alreadyRecorded) return existing;

    return prisma.fieldConflict.update({
      where: { id: existing.id },
      data: { values: JSON.parse(JSON.stringify([...values, entry])) },
    });
  }

  return prisma.fieldConflict.create({
    data: {
      dormId: opts.dormId,
      fieldName: opts.fieldName,
      values: JSON.parse(JSON.stringify([entry])),
      status: FieldConflictStatus.OPEN,
    },
  });
}

// ── Dorm Merge ────────────────────────────────────────────────────────────────

export interface MergeResult {
  migratedReviews: number;
  migratedSources: number;
  migratedFavorites: number;
  migratedFieldProvenance: number;
}

/**
 * Merge a duplicate dorm into its canonical target.
 *
 * Steps:
 * 1. Migrate reviews, DormSource links, FavoriteDorm, FieldProvenance from
 *    `sourceId` to `targetId` (handling unique constraints with upsert).
 * 2. Mark the source dorm as DUPLICATE with `duplicateOfId` pointing to target.
 *
 * The source dorm is NOT deleted so that existing external references remain
 * valid — callers may delete it explicitly afterward if desired.
 */
export async function mergeDorms(
  prisma: PrismaClient,
  opts: { targetId: string; sourceId: string }
): Promise<MergeResult> {
  // 1. Reviews — no unique constraint, safe bulk move
  const { count: migratedReviews } = await prisma.review.updateMany({
    where: { dormId: opts.sourceId },
    data: { dormId: opts.targetId },
  });

  // 2. DormSource — @@unique([dormId, sourceId]) → upsert
  const sourceDormSources = await prisma.dormSource.findMany({
    where: { dormId: opts.sourceId },
  });

  let migratedSources = 0;
  for (const ds of sourceDormSources) {
    await prisma.dormSource.upsert({
      where: {
        dormId_sourceId: { dormId: opts.targetId, sourceId: ds.sourceId },
      },
      create: {
        dormId: opts.targetId,
        sourceId: ds.sourceId,
        role: ds.role,
      },
      update: {},
    });
    // Remove old link
    await prisma.dormSource.delete({ where: { id: ds.id } });
    migratedSources++;
  }

  // 3. FavoriteDorm — @@unique([userId, dormId]) → upsert
  const sourceFavorites = await prisma.favoriteDorm.findMany({
    where: { dormId: opts.sourceId },
  });

  let migratedFavorites = 0;
  for (const fav of sourceFavorites) {
    await prisma.favoriteDorm.upsert({
      where: {
        userId_dormId: { userId: fav.userId, dormId: opts.targetId },
      },
      create: {
        userId: fav.userId,
        dormId: opts.targetId,
        notes: fav.notes,
      },
      update: {},
    });
    // Remove old favorite
    await prisma.favoriteDorm.delete({ where: { id: fav.id } });
    migratedFavorites++;
  }

  // 4. FieldProvenance — no unique constraint, bulk move
  const { count: migratedFieldProvenance } = await prisma.fieldProvenance.updateMany({
    where: { dormId: opts.sourceId },
    data: { dormId: opts.targetId },
  });

  // 5. Mark source dorm as DUPLICATE
  await prisma.dorm.update({
    where: { id: opts.sourceId },
    data: {
      dataQualityStatus: DataQualityStatus.DUPLICATE,
      duplicateOfId: opts.targetId,
      isActive: false,
    },
  });

  return { migratedReviews, migratedSources, migratedFavorites, migratedFieldProvenance };
}
