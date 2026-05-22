const DORM_TYPE_MAP: Record<string, string> = {
  "residence hall": "residence_hall",
  "res hall": "residence_hall",
  dormitory: "residence_hall",
  dorm: "residence_hall",
  suite: "suite",
  apartment: "apartment",
  townhouse: "townhouse",
};

const BATHROOM_MAP: Record<string, string> = {
  "community bathroom": "communal",
  "shared bathroom": "communal",
  "communal bathroom": "communal",
  communal: "communal",
  "suite bathroom": "suite",
  "suite-style": "suite",
  "private bathroom": "private",
  "in-room bathroom": "private",
};

const AC_MAP = ["a/c", "ac", "air conditioning", "air-conditioned", "central air"];

const ROOM_MAP: Record<string, string> = {
  "single room": "single",
  single: "single",
  "1-person room": "single",
  "double room": "double",
  "traditional double": "double",
  "2-person room": "double",
  triple: "triple",
  quad: "quad",
};

export function normalizeDormType(raw: string): string {
  const key = raw.toLowerCase().trim();
  return DORM_TYPE_MAP[key] ?? "unknown";
}

export function normalizeBathroom(raw: string): string {
  const key = raw.toLowerCase().trim();
  for (const [pattern, value] of Object.entries(BATHROOM_MAP)) {
    if (key.includes(pattern)) return value;
  }
  return "unknown";
}

export function normalizeAC(text: string): boolean | null {
  const lower = text.toLowerCase();
  if (lower.includes("no ac") || lower.includes("no air conditioning")) return false;
  if (AC_MAP.some((t) => lower.includes(t))) return true;
  return null;
}

export function normalizeRoomType(raw: string): string {
  const key = raw.toLowerCase().trim();
  return ROOM_MAP[key] ?? key.replace(/\s+/g, "_");
}

export interface ParsedPrice {
  amount: number;
  period: "yearly" | "semester" | "monthly" | "room_board" | "unknown";
  uncertain: boolean;
}

export function parsePrice(text: string): ParsedPrice | null {
  const lower = text.toLowerCase();
  const match = text.match(/\$?\s*([\d,]+(?:\.\d{2})?)/);
  if (!match) return null;

  const amount = parseFloat(match[1].replace(/,/g, ""));
  if (isNaN(amount) || amount < 100) return null;

  let period: ParsedPrice["period"] = "unknown";
  let uncertain = false;

  if (lower.includes("per month") || lower.includes("/month")) period = "monthly";
  else if (lower.includes("semester") || lower.includes("per term")) period = "semester";
  else if (lower.includes("year") || lower.includes("annual")) period = "yearly";
  else if (lower.includes("room and board") || lower.includes("room & board")) period = "room_board";
  else uncertain = true;

  return { amount, period, uncertain };
}

export function fuzzyDormNameMatch(a: string, b: string): number {
  const na = a.toLowerCase().replace(/residence hall|res hall|hall/gi, "").trim();
  const nb = b.toLowerCase().replace(/residence hall|res hall|hall/gi, "").trim();
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const wordsA = na.split(/\s+/);
  const wordsB = new Set(nb.split(/\s+/));
  const intersection = wordsA.filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...Array.from(wordsB)]).size;
  return union > 0 ? intersection / union : 0;
}
