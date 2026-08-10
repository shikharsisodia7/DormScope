/**
 * Detail-page fact enrichment from housing HTML.
 * Only extracts explicitly stated facts — never fabricates subjective scores.
 */
import * as cheerio from "cheerio";
import { normalizeAC, normalizeBathroom, parsePrice } from "@dormscope/shared";

export interface TriStateFacts {
  hasAC: boolean | null;
  elevatorAccess: boolean | null;
  kitchenAccess: boolean | null;
  laundryAccess: boolean | null;
  bathroomStyle: string | null;
  freshmanEligible: boolean | null;
  upperclassEligible: boolean | null;
  graduateEligible: boolean | null;
  mealPlanRequired: boolean | null;
  wheelchairAccessible: boolean | null;
  genderInclusive: boolean | null;
  floors: number | null;
  constructedYear: number | null;
  renovationYear: number | null;
  yearlyCost: number | null;
  semesterCost: number | null;
  roomTypes: string[];
  amenities: string[];
  address: string | null;
  floorPlanUrl: string | null;
  virtualTourUrl: string | null;
  imageUrl: string | null;
}

function boolFromText(text: string, positive: RegExp, negative: RegExp): boolean | null {
  if (negative.test(text)) return false;
  if (positive.test(text)) return true;
  return null;
}

export function extractDetailFacts(html: string, pageUrl: string): TriStateFacts {
  const $ = cheerio.load(html);
  const text = ($("main").text() || $("body").text()).replace(/\s+/g, " ").slice(0, 20000);

  const hasAC = normalizeAC(text);
  const elevatorAccess = boolFromText(text, /\belevators?\b/i, /\bno elevators?\b/i);
  const kitchenAccess = boolFromText(
    text,
    /\b(?:full |in[- ]unit )?kitchens?\b/i,
    /\bno (?:in[- ]unit )?kitchens?\b/i
  );
  const laundryAccess = boolFromText(text, /\blaundry\b/i, /\bno laundry\b/i);

  const bathRaw = normalizeBathroom(text);
  const bathroomStyle =
    bathRaw && bathRaw !== "UNKNOWN"
      ? bathRaw
      : /\bprivate bath/i.test(text)
        ? "PRIVATE"
        : /\bsuite bath/i.test(text)
          ? "SUITE"
          : /\bcommunal bath|community bath|shared bath/i.test(text)
            ? "COMMUNAL"
            : null;

  const freshmanEligible = boolFromText(
    text,
    /\b(?:first[- ]year|freshman)\s+(?:students?\s+)?(?:eligible|welcome|priority|housing)\b/i,
    /\b(?:not|no)\s+(?:available|open)\s+(?:to\s+)?(?:first[- ]year|freshman)/i
  );
  const upperclassEligible = boolFromText(
    text,
    /\b(?:upper[- ]?class|continuing|sophomore|junior|senior)\s+(?:students?\s+)?(?:eligible|welcome|housing)\b/i,
    /\b(?:first[- ]year|freshman)\s+only\b/i
  );
  const graduateEligible = boolFromText(
    text,
    /\bgraduate\s+(?:students?\s+)?(?:eligible|housing|apartments?)\b/i,
    /\bundergraduate\s+only\b/i
  );
  const mealPlanRequired = boolFromText(
    text,
    /\bmeal plan(?:s)?\s+(?:required|mandatory)\b/i,
    /\bmeal plan(?:s)?\s+(?:optional|not required)\b/i
  );
  const wheelchairAccessible = boolFromText(
    text,
    /\bwheelchair\s+access|\bADA\s+access|\baccessible\s+(?:rooms?|units?|housing)\b/i,
    /\bnot\s+wheelchair\s+accessible\b/i
  );
  const genderInclusive = boolFromText(
    text,
    /\bgender[- ]inclusive\b|\ball[- ]gender\b/i,
    /\bgender[- ]specific\s+only\b/i
  );

  const floorsMatch = text.match(/\b(\d{1,2})\s*(?:floors?|stories)\b/i);
  const floors = floorsMatch ? Number(floorsMatch[1]) : null;
  const built = text.match(/\b(?:built|constructed)\s+(?:in\s+)?(19|20)\d{2}\b/i);
  const renovated = text.match(/\brenovat(?:ed|ion)\s+(?:in\s+)?(19|20)\d{2}\b/i);

  const roomTypes: string[] = [];
  for (const [re, label] of [
    [/\bsingle\s+rooms?\b/i, "single"],
    [/\bdouble\s+rooms?\b/i, "double"],
    [/\btriple\s+rooms?\b/i, "triple"],
    [/\bquad\s+rooms?\b/i, "quad"],
    [/\bsuites?\b/i, "suite"],
    [/\bapartments?\b/i, "apartment"],
  ] as const) {
    if (re.test(text)) roomTypes.push(label);
  }

  const amenities: string[] = [];
  if (hasAC === true) amenities.push("ac");
  if (hasAC === false) amenities.push("no_ac");
  if (elevatorAccess === true) amenities.push("elevator");
  if (elevatorAccess === false) amenities.push("no_elevator");
  if (kitchenAccess === true) amenities.push("kitchen");
  if (kitchenAccess === false) amenities.push("no_kitchen");
  if (laundryAccess === true) amenities.push("laundry");
  if (laundryAccess === false) amenities.push("no_laundry");
  if (/study lounge/i.test(text)) amenities.push("study_lounge");

  let yearlyCost: number | null = null;
  let semesterCost: number | null = null;
  const priceMatches = text.match(/\$[\d,]+(?:\.\d{2})?[^.]{0,50}/g) ?? [];
  for (const pm of priceMatches.slice(0, 5)) {
    const parsed = parsePrice(pm);
    if (!parsed) continue;
    if (parsed.period === "yearly" || /academic|year/i.test(parsed.period)) yearlyCost = parsed.amount;
    if (parsed.period === "semester") semesterCost = parsed.amount;
  }

  let floorPlanUrl: string | null = null;
  let virtualTourUrl: string | null = null;
  let imageUrl: string | null = null;
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href");
    if (!href) return;
    try {
      const abs = new URL(href, pageUrl).toString();
      if (/floor[- ]?plan/i.test(href + $(a).text()) && !floorPlanUrl) floorPlanUrl = abs;
      if (/virtual\s*tour|matterport|youvisit/i.test(href + $(a).text()) && !virtualTourUrl) {
        virtualTourUrl = abs;
      }
    } catch {
      /* ignore */
    }
  });
  const img = $("main img, article img").first().attr("src");
  if (img) {
    try {
      const abs = new URL(img, pageUrl).toString();
      // Skip tiny logos / tracking
      if (!/logo|sprite|icon|1x1|pixel/i.test(abs)) imageUrl = abs;
    } catch {
      /* ignore */
    }
  }

  const addressMatch = text.match(/\b\d{1,5}\s+[A-Z][A-Za-z0-9 .'#-]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Way|Lane|Ln)\b/);
  const address = addressMatch ? addressMatch[0] : null;

  return {
    hasAC,
    elevatorAccess,
    kitchenAccess,
    laundryAccess,
    bathroomStyle,
    freshmanEligible,
    upperclassEligible,
    graduateEligible,
    mealPlanRequired,
    wheelchairAccessible,
    genderInclusive,
    floors,
    constructedYear: built ? Number(built[0].match(/\d{4}/)?.[0]) : null,
    renovationYear: renovated ? Number(renovated[0].match(/\d{4}/)?.[0]) : null,
    yearlyCost,
    semesterCost,
    roomTypes,
    amenities,
    address,
    floorPlanUrl,
    virtualTourUrl,
    imageUrl,
  };
}
