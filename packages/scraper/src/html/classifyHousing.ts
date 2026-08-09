/**
 * Contextual housing-entity classifier.
 * Acceptance is driven by page context + surrounding evidence.
 * Names contribute weak evidence only — never the sole gate —
 * but procedural/nav labels are hard-rejected.
 */

export type PageRole =
  | "housing_landing"
  | "housing_directory"
  | "housing_detail"
  | "rates"
  | "room_type"
  | "eligibility"
  | "floor_plan"
  | "map"
  | "irrelevant";

export interface ClassificationContext {
  pageUrl: string;
  pageRoles: PageRole[];
  surroundingText?: string;
  href?: string;
  inRepeatedStructure?: boolean;
  structuralRole?: "heading" | "card_title" | "link" | "table_cell" | "select_option" | "other";
  linkCountOnPage?: number;
}

export interface ClassificationResult {
  accepted: boolean;
  confidence: number;
  reasons: string[];
  entityKindHint?: string;
}

const NEGATIVE_EXACT =
  /^(residence halls?|residence life|residential life|housing|housing options|explore housing|apply( now)?|learn more|see this residence|view all|dining|meal plans?|move[- ]?in|move[- ]?out|living on campus|our residences|campus housing|student housing|undergraduate housing|graduate housing|family housing|theme programs?|specialized communities|living sustainably|home|menu|skip to|search|contact( us)?|about|staff|directory of staff|faq|faqs|rates?|room types?|floor plans?|virtual tour|map|parking|laundry facilities|how to apply|eligibility|important dates|news|events|policies|tours|health|safety|my room|compare housing options|housing guarantee|dates? (&|and) deadlines|bridge program|edge programs|housing task force|spring housing|off-campus housing|housing by user type|cancellations? (&|and) appeals|terms?,? conditions,? (&|and) agreements|transit and transportation|front desks? (&|and) housing facilities|mail service|cleaning (&|and) maintenance|technology (&|and)? ?services|winter break closure|living with a roommate|on-campus housing benefits|temporary quad room|optional apartment cleaning service|bed bugs.*|missing student policy.*|graduate housing assignment.*|family housing.*|how to .*|newly admitted.*|visiting scholar.*|summer .*housing.*|housing relocation.*)$/i;

const NEGATIVE_CONTAINS =
  /\b(dining hall|town hall|lecture hall|great hall|city hall|music hall|concert hall|residence life staff|housing staff|area coordinator|resident advisor|resident director|apply for housing|housing application|housing portal|meal plan|dining commons|food court|career center|student union|recreation center|fitness center|library|registrar|bursar|admissions office|faq|terms and conditions|terms & conditions|how to apply|how to read|assignment process|move-in|move-out|contact us|policies|deadlines|checklist|parking & directions|furniture leasing)\b/i;

const NEGATIVE_HREF =
  /\b(faq|policy|policies|terms|condition|apply|login|portal|move-in|move-out|contact|staff|news|event|deadline|cancellation|appeal|renewal|accommodation|checklist|parking|dining|meal|health|safety|laundry-facilit|technology|cleaning|roommate|sustainab|guarantee|task-force|bridge-program|edge-program)\b/i;

const POSITIVE_URL =
  /\/(housing|residence|residential|res-?life|living|dorm|halls?|units?|apartments?|villages?|communities|residences)\b/i;

const POSITIVE_SURROUND =
  /\b(residence hall|residential hall|housing option|living community|room type|double|single|suite|bathroom|laundry|floor plan|residents?|assignment|air conditioning|occupancy|bedrooms?|apartment|theme house|living.?learning|first[- ]year|upperclass|freshman housing|on[- ]campus housing|mini-suites?)\b/i;

/** Strong name evidence that something is a residence entity (not required alone). */
const STRONG_NAME =
  /\b(hall|house|houses|quad|tower|towers|villa|villas|residence|dorm|dormitory|commons|apartments?|suites?|village|manor|lodge|court|courts|inn|unit\s*\d+|complex|mini-suites?)\b/i;

const ENTITY_KIND_HINTS: Array<{ re: RegExp; kind: string }> = [
  { re: /\bunit\s*\d/i, kind: "UNIT" },
  { re: /\bvillage\b/i, kind: "VILLAGE" },
  { re: /\bcommons\b/i, kind: "COMPLEX" },
  { re: /\bcollege\b/i, kind: "RESIDENTIAL_COLLEGE" },
  { re: /\bapartments?\b/i, kind: "APARTMENT_COMMUNITY" },
  { re: /\bhouses?\b/i, kind: "HOUSE" },
  { re: /\bcomplex\b/i, kind: "COMPLEX" },
  { re: /\btowers?\b/i, kind: "BUILDING" },
  { re: /\bhall\b/i, kind: "BUILDING" },
  { re: /\bsuites?\b/i, kind: "SUITE_COMMUNITY" },
];

export function classifyPageRoles(url: string, htmlText: string): PageRole[] {
  const roles = new Set<PageRole>();
  const blob = `${url} ${htmlText.slice(0, 4000)}`.toLowerCase();
  if (/housing|residence|residential|res-?life|living on campus/.test(blob)) {
    roles.add("housing_landing");
  }
  if (
    /housing options|residence halls|our residences|find (your )?home|explore housing|residential communities/.test(
      blob
    )
  ) {
    roles.add("housing_directory");
  }
  if (/room type|floor plan|rates?|cost|meal plan|eligibility|amenities/.test(blob)) {
    if (/rate|cost|price|tuition/.test(blob)) roles.add("rates");
    if (/room type|occupancy|double|single/.test(blob)) roles.add("room_type");
    if (/eligib|freshman|upperclass|graduate/.test(blob)) roles.add("eligibility");
    if (/floor plan/.test(blob)) roles.add("floor_plan");
  }
  if (/\/maps?\/|campus map|housing map/.test(blob)) roles.add("map");
  if (roles.size === 0) roles.add("irrelevant");
  return Array.from(roles);
}

export function classifyHousingCandidate(
  rawName: string,
  ctx: ClassificationContext
): ClassificationResult {
  const name = rawName.replace(/\s+/g, " ").trim();
  const reasons: string[] = [];
  let score = 0;

  if (name.length < 2 || name.length > 90) {
    return { accepted: false, confidence: 0, reasons: ["name_length_out_of_range"] };
  }

  if (NEGATIVE_EXACT.test(name)) {
    return { accepted: false, confidence: 0.95, reasons: ["negative_exact_nav_or_section_heading"] };
  }

  if (NEGATIVE_CONTAINS.test(name) || NEGATIVE_CONTAINS.test(ctx.surroundingText ?? "")) {
    return { accepted: false, confidence: 0.9, reasons: ["negative_facility_or_staff_context"] };
  }

  if (ctx.href && NEGATIVE_HREF.test(ctx.href)) {
    return { accepted: false, confidence: 0.85, reasons: ["negative_href_procedural"] };
  }

  // Procedural / instructional titles
  if (/^(how to|newly admitted|graduate student|family student|undergraduate|visiting|optional|temporary|summer |spring |winter |medical|dates)/i.test(name)) {
    return { accepted: false, confidence: 0.9, reasons: ["negative_procedural_title"] };
  }

  const onHousingPage = ctx.pageRoles.some((r) =>
    ["housing_landing", "housing_directory", "housing_detail", "rates", "room_type"].includes(r)
  );
  if (!onHousingPage) {
    return { accepted: false, confidence: 0.2, reasons: ["not_on_housing_page"] };
  }
  reasons.push("on_housing_page");

  const strongName = STRONG_NAME.test(name) || /^unit\s*\d+[a-z]?$/i.test(name);
  if (strongName) {
    score += 0.35;
    reasons.push("strong_housing_name_evidence");
  }

  const surround = ctx.surroundingText ?? "";
  const strongSurround = POSITIVE_SURROUND.test(surround);
  if (strongSurround) {
    score += 0.25;
    reasons.push("housing_evidence_in_surrounding_text");
  }

  if (ctx.inRepeatedStructure && (strongName || strongSurround)) {
    score += 0.2;
    reasons.push("repeated_directory_structure");
  }

  if (ctx.structuralRole === "card_title" && (strongName || strongSurround)) {
    score += 0.1;
    reasons.push("structural_card_title");
  }

  if (ctx.structuralRole === "link" && POSITIVE_URL.test(ctx.href ?? "") && strongName) {
    score += 0.15;
    reasons.push("housing_path_link_with_entity_name");
  }

  if (POSITIVE_URL.test(ctx.pageUrl) && strongName) {
    score += 0.1;
    reasons.push("housing_url_with_entity_name");
  }

  // Bare proper names (e.g. "Foothill", "Stern") only if card/list + strong surround
  if (!strongName && ctx.inRepeatedStructure && strongSurround && /^[A-Z][A-Za-z0-9 .'&\-]{2,60}$/.test(name)) {
    score += 0.35;
    reasons.push("proper_name_in_housing_card_with_evidence");
  }

  if (/\b(school of|college of|department|center for|institute)\b/i.test(name) && !strongSurround) {
    score -= 0.4;
    reasons.push("academic_name_without_strong_housing_context");
  }

  // Must clear a higher bar: context alone is insufficient without entity signals
  const accepted = score >= 0.5 && (strongName || strongSurround);
  if (!accepted) {
    reasons.push("insufficient_entity_evidence");
  }

  let entityKindHint: string | undefined;
  for (const h of ENTITY_KIND_HINTS) {
    if (h.re.test(name)) {
      entityKindHint = h.kind;
      break;
    }
  }

  return {
    accepted,
    confidence: Math.max(0, Math.min(1, accepted ? Math.max(score, 0.55) : score)),
    reasons,
    entityKindHint,
  };
}
