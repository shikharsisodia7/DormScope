import { fuzzyDormNameMatch } from "@dormscope/shared";

const WORD_TO_DIGIT: Record<string, string> = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
};

const DIRECTIONS = ["north", "south", "east", "west", "upper", "lower"] as const;

function normalizeEntityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|residence|hall|dormitory|dorm|building|community)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractNumberSignature(normalized: string): string {
  const parts: string[] = [];
  for (const token of normalized.split(/\s+/)) {
    if (!token) continue;
    const digits = token.match(/\d+/);
    if (digits) {
      parts.push(digits[0]);
      continue;
    }
    const word = WORD_TO_DIGIT[token];
    if (word) parts.push(word);
  }
  return parts.join(",");
}

function stripNumberTokens(normalized: string): string {
  return normalized
    .split(/\s+/)
    .filter((token) => token && !/\d+/.test(token) && !WORD_TO_DIGIT[token])
    .join(" ")
    .trim();
}

/**
 * Safer entity resolution: exact slug / exact alias merge automatically.
 * High fuzzy scores that preserve meaningful numbers/directions only merge
 * when normalized tokens match closely; otherwise skip (no destructive merge).
 */
export function safeSameEntity(a: string, b: string): boolean {
  const na = normalizeEntityName(a);
  const nb = normalizeEntityName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const numsA = extractNumberSignature(na);
  const numsB = extractNumberSignature(nb);
  if (numsA !== numsB) return false;

  for (const d of DIRECTIONS) {
    if (na.includes(d) !== nb.includes(d)) return false;
  }

  const baseA = stripNumberTokens(na);
  const baseB = stripNumberTokens(nb);
  if (numsA && baseA && baseA === baseB) return true;

  return fuzzyDormNameMatch(a, b) >= 0.92;
}
