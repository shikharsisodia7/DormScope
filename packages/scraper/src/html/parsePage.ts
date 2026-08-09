import * as cheerio from "cheerio";
import { normalizeAC, normalizeBathroom, parsePrice } from "@dormscope/shared";
import {
  classifyHousingCandidate,
  classifyPageRoles,
  type ClassificationResult,
  type PageRole,
} from "./classifyHousing.js";

export interface ExtractedDorm {
  name: string;
  description?: string;
  amenities: string[];
  costs: { label: string; amount: number; period: string; uncertain: boolean }[];
  imageUrl?: string;
  links: string[];
  entityKindHint?: string;
  classification?: ClassificationResult;
  detailUrl?: string;
  officialCategoryLabel?: string;
  parentNameHint?: string;
}

export interface ParseHousingResult {
  pageRoles: PageRole[];
  accepted: ExtractedDorm[];
  rejected: Array<{ name: string; classification: ClassificationResult }>;
}

function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").replace(/[\u00a0]/g, " ").trim();
}

function amenitiesFromText(text: string): string[] {
  const amenities: string[] = [];
  if (normalizeAC(text)) amenities.push("ac");
  if (/laundry/i.test(text)) amenities.push("laundry");
  if (/kitchen/i.test(text)) amenities.push("kitchen");
  if (/study lounge/i.test(text)) amenities.push("study_lounge");
  return amenities;
}

function costsFromText(text: string): ExtractedDorm["costs"] {
  const costs: ExtractedDorm["costs"] = [];
  const priceMatches = text.match(/\$[\d,]+(?:\.\d{2})?[^.]{0,40}/g) ?? [];
  for (const pm of priceMatches.slice(0, 3)) {
    const parsed = parsePrice(pm);
    if (parsed) {
      costs.push({
        label: "Housing cost",
        amount: parsed.amount,
        period: parsed.period,
        uncertain: parsed.uncertain,
      });
    }
  }
  return costs;
}

function titleFromSlug(href: string): string | null {
  try {
    const path = new URL(href).pathname.replace(/\/$/, "");
    const last = path.split("/").filter(Boolean).pop();
    if (!last) return null;
    return cleanName(
      decodeURIComponent(last)
        .replace(/[-_]+/g, " ")
        .replace(/\bunit\s+(\d+)/i, "Unit $1")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    );
  } catch {
    return null;
  }
}

/**
 * Extract housing entities using contextual classification (not Hall-name gating).
 */
export function parseHousingHtmlDetailed(html: string, baseUrl: string): ParseHousingResult {
  const $ = cheerio.load(html);
  const pageText = $("body").text().replace(/\s+/g, " ").slice(0, 12000);
  const pageRoles = classifyPageRoles(baseUrl, pageText);
  const accepted: ExtractedDorm[] = [];
  const rejected: Array<{ name: string; classification: ClassificationResult }> = [];
  const seen = new Set<string>();

  const consider = (
    rawName: string,
    opts: {
      surroundingText: string;
      href?: string;
      inRepeatedStructure?: boolean;
      structuralRole?: "heading" | "card_title" | "link" | "table_cell" | "select_option" | "other";
      links?: string[];
      imageUrl?: string;
    }
  ) => {
    const name = cleanName(rawName);
    if (!name || seen.has(name.toLowerCase())) return;
    const classification = classifyHousingCandidate(name, {
      pageUrl: baseUrl,
      pageRoles,
      surroundingText: opts.surroundingText,
      href: opts.href,
      inRepeatedStructure: opts.inRepeatedStructure,
      structuralRole: opts.structuralRole,
    });
    if (!classification.accepted) {
      rejected.push({ name, classification });
      return;
    }
    seen.add(name.toLowerCase());
    accepted.push({
      name,
      description: opts.surroundingText.slice(0, 500) || undefined,
      amenities: amenitiesFromText(opts.surroundingText),
      costs: costsFromText(opts.surroundingText),
      imageUrl: opts.imageUrl,
      links: opts.links ?? (opts.href ? [opts.href] : []),
      entityKindHint: classification.entityKindHint,
      classification,
      detailUrl: opts.href,
    });
  };

  // Repeated cards / list items — strongest directory signal
  const cardSelectors = [
    "article",
    ".card",
    ".views-row",
    ".teaser",
    "[class*='housing-card']",
    "[class*='residence-card']",
    "li.menu-item",
    ".accordion-item",
    "table tbody tr",
  ];
  for (const sel of cardSelectors) {
    const nodes = $(sel);
    const repeated = nodes.length >= 3;
    nodes.each((_, el) => {
      const $el = $(el);
      const title =
        cleanName($el.find("h1,h2,h3,h4,.title,.card-title,a").first().text()) ||
        cleanName($el.find("td").first().text());
      if (!title) return;
      const href = $el.find("a[href]").first().attr("href");
      let absolute: string | undefined;
      if (href) {
        try {
          absolute = new URL(href, baseUrl).toString();
        } catch {
          /* ignore */
        }
      }
      let imageUrl: string | undefined;
      const img = $el.find("img").first().attr("src");
      if (img) {
        try {
          imageUrl = new URL(img, baseUrl).toString();
        } catch {
          /* ignore */
        }
      }
      consider(title, {
        surroundingText: $el.text(),
        href: absolute,
        inRepeatedStructure: repeated,
        structuralRole: sel.includes("tr") ? "table_cell" : "card_title",
        links: absolute ? [absolute] : [],
        imageUrl,
      });
    });
  }

  // Headings
  $("h1, h2, h3, h4").each((_, el) => {
    const name = cleanName($(el).text());
    const section = $(el).parent();
    consider(name, {
      surroundingText: section.text(),
      inRepeatedStructure: false,
      structuralRole: "heading",
    });
  });

  // Housing-path links (Unit 1 / Unit 2 style menus)
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href");
    if (!href) return;
    let absolute: string;
    try {
      absolute = new URL(href, baseUrl).toString();
    } catch {
      return;
    }
    const linkText = cleanName($(a).text());
    const fromSlug = titleFromSlug(absolute);
    const name = linkText.length >= 2 ? linkText : fromSlug;
    if (!name) return;
    if (!/housing|residenc|living|unit|apartment|hall|dorm|village|commons/i.test(absolute + " " + name)) {
      return;
    }
    consider(name, {
      surroundingText: linkText,
      href: absolute,
      inRepeatedStructure: true,
      structuralRole: "link",
      links: [absolute],
    });
  });

  // <select> options on housing forms
  $("select option").each((_, opt) => {
    const name = cleanName($(opt).text());
    if (!name || /select|choose|please/i.test(name)) return;
    consider(name, {
      surroundingText: "housing select option room assignment",
      inRepeatedStructure: true,
      structuralRole: "select_option",
    });
  });

  return {
    pageRoles,
    accepted: accepted.slice(0, 120),
    rejected: rejected.slice(0, 80),
  };
}

/** Backward-compatible wrapper used by existing callers. */
export function parseHousingHtml(html: string, baseUrl: string): ExtractedDorm[] {
  return parseHousingHtmlDetailed(html, baseUrl).accepted;
}

export function parsePageMetadata(html: string, baseUrl?: string): { title: string; links: string[]; pageRoles: PageRole[] } {
  const $ = cheerio.load(html);
  const title = $("title").text().trim();
  const pageRoles = classifyPageRoles(baseUrl ?? "", $("body").text());
  const links: string[] = [];
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href");
    if (!href) return;
    const text = $(a).text();
    if (!/housing|residence|dorm|room|board|rates|res[\s-]?life|living|unit|apartment|village/i.test(href + " " + text)) {
      return;
    }
    try {
      links.push(baseUrl ? new URL(href, baseUrl).toString() : href);
    } catch {
      links.push(href);
    }
  });
  return { title, links: Array.from(new Set(links)).slice(0, 60), pageRoles };
}

export { normalizeBathroom, classifyHousingCandidate, classifyPageRoles };
