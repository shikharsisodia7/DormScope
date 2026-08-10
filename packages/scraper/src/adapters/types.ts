/**
 * Adapter interface for university CMS / structured-data extractors.
 * Generic HTML parser remains the default; adapters opt in via matches().
 */
export interface AdapterContext {
  url: string;
  html: string;
  collegeSlug?: string;
  domain?: string;
}

export interface AdapterDirectoryResult {
  entities: Array<{
    name: string;
    detailUrl?: string;
    description?: string;
    parentNameHint?: string;
    officialCategoryLabel?: string;
    entityKindHint?: string;
  }>;
  nextPages?: string[];
}

export interface AdapterDetailResult {
  facts: Record<string, unknown>;
  amenities: string[];
}

export interface HousingAdapter {
  id: string;
  matches(ctx: AdapterContext): boolean;
  discover?(ctx: AdapterContext): Promise<string[]>;
  extractDirectory?(ctx: AdapterContext): Promise<AdapterDirectoryResult>;
  extractDetail?(ctx: AdapterContext): Promise<AdapterDetailResult>;
}

/** Extract public __NEXT_DATA__ / JSON-LD payloads when present. */
export const nextDataAdapter: HousingAdapter = {
  id: "next-data",
  matches(ctx) {
    return /__NEXT_DATA__/i.test(ctx.html);
  },
  async extractDirectory(ctx) {
    const m = ctx.html.match(
      /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
    );
    if (!m) return { entities: [] };
    try {
      const data = JSON.parse(m[1]);
      const blob = JSON.stringify(data);
      const entities: AdapterDirectoryResult["entities"] = [];
      const nameRe =
        /"name"\s*:\s*"([^"]{3,80})"/g;
      const seen = new Set<string>();
      let match: RegExpExecArray | null;
      while ((match = nameRe.exec(blob)) && entities.length < 80) {
        const name = match[1];
        if (seen.has(name.toLowerCase())) continue;
        if (!/hall|house|unit|apartment|village|residence|dorm|commons/i.test(name)) continue;
        if (/how to|apply|faq|policy|dining|meal/i.test(name)) continue;
        seen.add(name.toLowerCase());
        entities.push({ name, entityKindHint: /unit\s*\d/i.test(name) ? "UNIT" : undefined });
      }
      return { entities };
    } catch {
      return { entities: [] };
    }
  },
};

export const adapters: HousingAdapter[] = [nextDataAdapter];

export function selectAdapter(ctx: AdapterContext): HousingAdapter | null {
  return adapters.find((a) => a.matches(ctx)) ?? null;
}
