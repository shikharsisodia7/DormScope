import { SourceType } from "@prisma/client";

export function sourceConfidence(type: SourceType, pageAgeDays?: number): number {
  const base: Record<SourceType, number> = {
    OFFICIAL_WEBSITE: 0.95,
    OFFICIAL_PDF: 0.92,
    HOUSING_RATES: 0.9,
    CAMPUS_MAP: 0.75,
    RESIDENCE_LIFE: 0.88,
    PUBLIC_REVIEW: 0.45,
    STUDENT_FORUM: 0.35,
    OTHER: 0.5,
  };
  let score = base[type] ?? 0.5;
  if (pageAgeDays && pageAgeDays > 730) score -= 0.15;
  if (pageAgeDays && pageAgeDays > 1095) score -= 0.1;
  return Math.max(0.2, Math.min(1, score));
}

export function fieldConfidence(sources: number[], official: boolean): number {
  if (sources.length === 0) return 0;
  const base = official ? 0.85 : 0.5;
  return Math.min(1, base + sources.length * 0.05);
}

export function completenessScore(fields: Record<string, unknown>): number {
  const keys = Object.keys(fields);
  const filled = keys.filter((k) => fields[k] != null && fields[k] !== "").length;
  return keys.length ? filled / keys.length : 0;
}
