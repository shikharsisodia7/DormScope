import * as cheerio from "cheerio";
import { normalizeAC, normalizeBathroom, parsePrice } from "@dormscope/shared";
import {
  classifyHousingCandidate,
  classifyPageRoles,
  classifyPageRolesFromSignals,
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
  spaSignals: boolean;
}

function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").replace(/[\u00a0]/g, " ").trim();
}

function amenitiesFromText(text: string): string[] {
  const amenities: string[] = [];
  const ac = normalizeAC(text);
  if (ac === true) amenities.push("ac");
  if (ac === false) amenities.push("no_ac");
  if (/no\s+(?:in[- ]?unit\s+)?(?:air conditioning|a\/?c)\b/i.test(text)) {
    if (!amenities.includes("no_ac")) amenities.push("no_ac");
  }
  if (/\bno elevator\b/i.test(text)) amenities.push("no_elevator");
  else if (/\belevator\b/i.test(text)) amenities.push("elevator");
  if (/\bno (?:in[- ]?unit )?kitchen\b/i.test(text)) amenities.push("no_kitchen");
  else if (/kitchen/i.test(text)) amenities.push("kitchen");
  if (/\bno laundry\b/i.test(text)) amenities.push("no_laundry");
  else if (/laundry/i.test(text)) amenities.push("laundry");
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

function detectSpaSignals(html: string, $: ReturnType<typeof cheerio.load>): boolean {
  if (
    /__NEXT_DATA__|__NUXT__|ng-version|data-reactroot|id=["']__next["']|id=["']app["']\s*>\s*<\/div>/i.test(
      html
    )
  ) {
    return true;
  }
  const mainText = ($("main").text() || $("body").text()).replace(/\s+/g, " ").trim();
  if (mainText.length < 200 && (html.match(/<script/gi) ?? []).length >= 8) return true;
  if (/loading\.\.\.|please wait|skeleton|hydrat/i.test(mainText) && mainText.length < 800) {
    return true;
  }
  return false;
}

type ChromeRole = "main" | "nav" | "header" | "footer" | "aside" | "unknown";

function chromeRole($el: cheerio.Cheerio<any>): ChromeRole {
  if (
    $el.closest(
      "nav, [role='navigation'], .nav, .navbar, .menu, .mega-menu, .breadcrumb, .breadcrumbs"
    ).length
  ) {
    return "nav";
  }
  if ($el.closest("header").length) return "header";
  if ($el.closest("footer").length) return "footer";
  if ($el.closest("aside, .sidebar, .utility-nav, .cookie, #cookie").length) return "aside";
  if ($el.closest("main, [role='main'], #main, #content, .main-content").length) return "main";
  return "unknown";
}

/**
 * Extract housing entities using contextual classification (not Hall-name gating).
 * Prefer <main> content; skip site chrome for candidate discovery.
 */
export function parseHousingHtmlDetailed(html: string, baseUrl: string): ParseHousingResult {
  const $ = cheerio.load(html);
  const spaSignals = detectSpaSignals(html, $);

  const title = $("title").first().text().trim();
  const h1 = $("h1").first().text().trim();
  const ogTitle = $('meta[property="og:title"]').attr("content") ?? "";
  const breadcrumbs = $(".breadcrumb, .breadcrumbs, nav[aria-label*='breadcrumb' i]").text();
  const mainHeadings = ($("main h1, main h2, main h3").text() || $("h1, h2").text()).slice(0, 1500);
  const pageText = ($("main").text() || $("body").text()).replace(/\s+/g, " ").slice(0, 12000);

  const pageRoles = classifyPageRolesFromSignals({
    url: baseUrl,
    title,
    h1,
    ogTitle,
    breadcrumbs,
    mainHeadings,
    bodySample: pageText,
  });

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
      pageRole?: ChromeRole;
      selectorType?: string;
      parentNameHint?: string;
      officialCategoryLabel?: string;
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
      pageRole: opts.pageRole,
      selectorType: opts.selectorType,
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
      parentNameHint: opts.parentNameHint,
      officialCategoryLabel: opts.officialCategoryLabel,
    });
  };

  const root = $("main").length ? $("main") : $("body");

  const cardSelectors = [
    "article",
    ".card",
    ".views-row",
    ".teaser",
    "[class*='housing-card']",
    "[class*='residence-card']",
    ".accordion-item",
    "table tbody tr",
  ];

  for (const sel of cardSelectors) {
    const nodes = root.find(sel);
    const repeated = nodes.length >= 3;
    nodes.each((_, el) => {
      const $el = $(el);
      const role = chromeRole($el);
      if (role === "nav" || role === "footer" || role === "header") return;
      const titleText =
        cleanName($el.find("h1,h2,h3,h4,.title,.card-title,a").first().text()) ||
        cleanName($el.find("td").first().text());
      if (!titleText) return;
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
      const sectionHeading = cleanName(
        $el.closest("section, .section").find("h1,h2,h3").first().text()
      );
      consider(titleText, {
        surroundingText: $el.text(),
        href: absolute,
        inRepeatedStructure: repeated,
        structuralRole: sel.includes("tr") ? "table_cell" : "card_title",
        links: absolute ? [absolute] : [],
        imageUrl,
        pageRole: role,
        selectorType: sel,
        officialCategoryLabel: sectionHeading || undefined,
        parentNameHint:
          /village|college|complex|community|unit/i.test(sectionHeading) &&
          sectionHeading !== titleText
            ? sectionHeading
            : undefined,
      });
    });
  }

  root.find("h1, h2, h3, h4").each((_, el) => {
    const $el = $(el);
    const role = chromeRole($el);
    if (role === "nav" || role === "footer" || role === "header") return;
    const name = cleanName($el.text());
    const section = $el.parent();
    const siblingCards = section.find("article, .card, li, tr").length;
    consider(name, {
      surroundingText: section.text(),
      inRepeatedStructure: siblingCards >= 3,
      structuralRole: "heading",
      pageRole: role === "unknown" && $("main").length ? "main" : role,
      selectorType: "heading",
    });
  });

  root.find("a[href]").each((_, a) => {
    const $a = $(a);
    const role = chromeRole($a);
    if (role === "nav" || role === "footer" || role === "header") return;
    const href = $a.attr("href");
    if (!href) return;
    let absolute: string;
    try {
      absolute = new URL(href, baseUrl).toString();
    } catch {
      return;
    }
    const linkText = cleanName($a.text());
    const fromSlug = titleFromSlug(absolute);
    const name = linkText.length >= 2 ? linkText : fromSlug;
    if (!name) return;
    if (
      !/housing|residenc|living|unit|apartment|hall|dorm|village|commons/i.test(absolute + " " + name)
    ) {
      return;
    }
    consider(name, {
      surroundingText: $a.parent().text().slice(0, 400) || linkText,
      href: absolute,
      inRepeatedStructure: true,
      structuralRole: "link",
      links: [absolute],
      pageRole: role === "unknown" && $("main").length ? "main" : role,
      selectorType: "a[href]",
    });
  });

  root.find("select option").each((_, opt) => {
    const name = cleanName($(opt).text());
    if (!name || /select|choose|please/i.test(name)) return;
    consider(name, {
      surroundingText: "housing select option room assignment",
      inRepeatedStructure: true,
      structuralRole: "select_option",
      pageRole: "main",
      selectorType: "select option",
    });
  });

  return {
    pageRoles,
    accepted: accepted.slice(0, 120),
    rejected: rejected.slice(0, 80),
    spaSignals,
  };
}

/** Backward-compatible wrapper used by existing callers. */
export function parseHousingHtml(html: string, baseUrl: string): ExtractedDorm[] {
  return parseHousingHtmlDetailed(html, baseUrl).accepted;
}

export function parsePageMetadata(
  html: string,
  baseUrl?: string
): { title: string; links: string[]; pageRoles: PageRole[] } {
  const $ = cheerio.load(html);
  const title = $("title").text().trim();
  const pageRoles = classifyPageRolesFromSignals({
    url: baseUrl ?? "",
    title,
    h1: $("h1").first().text(),
    bodySample: ($("main").text() || $("body").text()).slice(0, 4000),
  });
  const links: string[] = [];
  const linkRoot = $("main").length ? $("main") : $("body");
  linkRoot.find("a[href]").each((_, a) => {
    const $a = $(a);
    if ($a.closest("nav, footer, header").length) return;
    const href = $a.attr("href");
    if (!href) return;
    const text = $a.text();
    if (
      !/housing|residence|dorm|room|board|rates|res[\s-]?life|living|unit|apartment|village/i.test(
        href + " " + text
      )
    ) {
      return;
    }
    if (/instagram|facebook|twitter|linkedin|youtube|google\.com\/maps|yelp|airbnb/i.test(href)) {
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

export {
  normalizeBathroom,
  classifyHousingCandidate,
  classifyPageRoles,
  classifyPageRolesFromSignals,
};
