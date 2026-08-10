/**
 * Contextual housing-entity classifier.
 * Acceptance is driven by page context + surrounding evidence.
 * Names contribute weak evidence only — never the sole gate —
 * but procedural/nav labels are hard-rejected.
 *
 * Name negatives ≠ surrounding-text negatives:
 * "Dining Hall" as a candidate name is rejected;
 * "Swig Hall — near Benson dining hall" is not.
 */

export type PageRole =
  | "housing_landing"
  | "housing_directory"
  | "housing_detail"
  | "rates"
  | "room_type"
  | "eligibility"
  | "floor_plan"
  | "application"
  | "staff"
  | "faq"
  | "map"
  | "irrelevant";

export interface ClassificationContext {
  pageUrl: string;
  pageRoles: PageRole[];
  surroundingText?: string;
  href?: string;
  inRepeatedStructure?: boolean;
  structuralRole?: "heading" | "card_title" | "link" | "table_cell" | "select_option" | "other";
  /** Where in the DOM this candidate came from */
  pageRole?: "main" | "nav" | "header" | "footer" | "aside" | "unknown";
  selectorType?: string;
  linkCountOnPage?: number;
}

export interface ClassificationResult {
  accepted: boolean;
  confidence: number;
  reasons: string[];
  entityKindHint?: string;
  metadata?: Record<string, unknown>;
}

const NEGATIVE_EXACT =
  /^(residence halls?|residence life|residential life|housing|housing options|explore housing|apply( now)?|learn more|see this residence|view all|dining|meal plans?|move[- ]?in|move[- ]?out|living on campus|our residences|campus housing|student housing|undergraduate housing|graduate housing|family housing|theme programs?|specialized communities|living sustainably|home|menu|skip to|search|contact( us)?|about|staff|directory of staff|faq|faqs|rates?|room types?|floor plans?|virtual tour|map|parking|laundry facilities|how to apply|eligibility|important dates|news|events|policies|tours|health|safety|my room|compare housing options|housing guarantee|dates? (&|and) deadlines|bridge program|edge programs|housing task force|spring housing|off-campus housing|housing by user type|cancellations? (&|and) appeals|terms?,? conditions,? (&|and) agreements|transit and transportation|front desks? (&|and) housing facilities|mail service|cleaning (&|and) maintenance|technology (&|and)? ?services|winter break closure|living with a roommate|on-campus housing benefits|temporary quad room|optional apartment cleaning service|bed bugs.*|missing student policy.*|graduate housing assignment.*|family housing.*|how to .*|newly admitted.*|visiting scholar.*|summer .*housing.*|housing relocation.*|housing application)$/i;

/** Hard reject when these appear in the candidate NAME itself. */
const NEGATIVE_NAME =
  /\b(dining hall|town hall|lecture hall|great hall|city hall|music hall|concert hall|residence life staff|housing staff|housing application|housing portal|meal plan|dining commons|food court|career center|student union|recreation center|fitness center|library|registrar|bursar|admissions office)\b/i;

/**
 * Soft negatives in surrounding description only — weighted penalty, not absolute reject.
 * A valid hall can mention "near the dining hall and library".
 */
const SOFT_SURROUND_NEGATIVE =
  /\b(how to apply|assignment process|move-in|move-out|terms and conditions|terms & conditions|deadlines|checklist|furniture leasing|parking & directions)\b/i;

const NEGATIVE_HREF =
  /\b(faq|policy|policies|terms|condition|apply|login|portal|move-in|move-out|contact|staff|news|event|deadline|cancellation|appeal|renewal|accommodation|checklist|parking|dining|meal|health|safety|laundry-facilit|technology|cleaning|roommate|sustainab|guarantee|task-force|bridge-program|edge-program)\b/i;

const POSITIVE_URL =
  /\/(housing|residence|residential|res-?life|living|dorm|halls?|units?|apartments?|villages?|communities|residences)\b/i;

const POSITIVE_SURROUND =
  /\b(residence hall|residential hall|housing option|living community|room type|double|single|suite|bathroom|laundry|floor plan|residents?|assignment|air conditioning|occupancy|bedrooms?|apartment|theme house|living.?learning|first[- ]year|upperclass|freshman housing|on[- ]campus housing|mini-suites?)\b/i;

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

export interface PageRoleSignals {
  url: string;
  title?: string;
  h1?: string;
  ogTitle?: string;
  breadcrumbs?: string;
  mainHeadings?: string;
  bodySample?: string;
}

/**
 * Stronger page-role classification using title/h1/URL — not a generic "housing" substring alone.
 */
export function classifyPageRolesFromSignals(signals: PageRoleSignals): PageRole[] {
  const roles = new Set<PageRole>();
  const url = (signals.url ?? "").toLowerCase();
  const title = (signals.title ?? "").toLowerCase();
  const h1 = (signals.h1 ?? "").toLowerCase();
  const og = (signals.ogTitle ?? "").toLowerCase();
  const crumbs = (signals.breadcrumbs ?? "").toLowerCase();
  const headings = (signals.mainHeadings ?? "").toLowerCase();
  const headBlob = `${title} ${h1} ${og} ${crumbs} ${headings}`;
  const body = (signals.bodySample ?? "").toLowerCase().slice(0, 4000);

  const pathHousing = POSITIVE_URL.test(url);
  const headHousing =
    /\b(housing|residence halls?|residential life|res(?:idence)? life|living on campus|housing options)\b/.test(
      headBlob
    );

  if (/how to apply|housing application|apply for housing|assignment process/.test(headBlob)) {
    roles.add("application");
  }
  if (/\bstaff\b|directory of staff|contact housing/.test(headBlob)) {
    roles.add("staff");
  }
  if (/\bfaqs?\b|frequently asked/.test(headBlob)) {
    roles.add("faq");
  }
  if (/\/maps?\/|campus map|housing map/.test(`${url} ${headBlob}`)) {
    roles.add("map");
  }
  if (/\brates?\b|room (?:and|&) board|housing cost|price/.test(headBlob) || /\/rates?\b/.test(url)) {
    roles.add("rates");
  }
  if (/room types?|occupancy|double|single room/.test(headBlob)) {
    roles.add("room_type");
  }
  if (/eligib|freshman|upperclass|graduate housing/.test(headBlob)) {
    roles.add("eligibility");
  }
  if (/floor plan/.test(headBlob)) {
    roles.add("floor_plan");
  }

  const directoryHead =
    /housing options|residence halls|our residences|find (?:your )?home|explore housing|residential communities|undergraduate housing/.test(
      headBlob
    ) || /residence-halls|housing-options|explore-housing|our-residences/.test(url);

  const detailPath = /\/(unit|hall|house|apartment|village|commons|residence)[-_/][\w-]+\/?$/i.test(url);

  // Procedural pages mentioning housing in nav body alone should not become directories
  if (roles.has("application") || roles.has("staff") || roles.has("faq")) {
    if (!directoryHead && !detailPath) {
      if (roles.size === 0) roles.add("irrelevant");
      return Array.from(roles);
    }
  }

  if (directoryHead && (pathHousing || headHousing)) {
    roles.add("housing_directory");
  }
  if (detailPath && (pathHousing || headHousing)) {
    roles.add("housing_detail");
  }
  if ((pathHousing || headHousing) && !roles.has("housing_directory") && !roles.has("housing_detail")) {
    // Require stronger than body-only "housing" mention
    if (headHousing || pathHousing) {
      roles.add("housing_landing");
    }
  }

  // Body-only generic "housing" without head/URL signals → irrelevant
  if (roles.size === 0) {
    if (/\bhousing\b/.test(body) && pathHousing) {
      roles.add("housing_landing");
    } else {
      roles.add("irrelevant");
    }
  }

  return Array.from(roles);
}

/** Backward-compatible wrapper used by older call sites. */
export function classifyPageRoles(url: string, htmlText: string): PageRole[] {
  return classifyPageRolesFromSignals({
    url,
    bodySample: htmlText,
    title: htmlText.slice(0, 200),
  });
}

export function classifyHousingCandidate(
  rawName: string,
  ctx: ClassificationContext
): ClassificationResult {
  const name = rawName.replace(/\s+/g, " ").trim();
  const reasons: string[] = [];
  let score = 0;
  const metadata: Record<string, unknown> = {
    selectorType: ctx.selectorType ?? null,
    structuralRole: ctx.structuralRole ?? null,
    pageRole: ctx.pageRole ?? "unknown",
    candidateHref: ctx.href ?? null,
    contextSnippet: (ctx.surroundingText ?? "").slice(0, 160),
  };

  if (name.length < 2 || name.length > 90) {
    return { accepted: false, confidence: 0, reasons: ["name_length_out_of_range"], metadata };
  }

  // Nav/header/footer candidates need exceptional evidence
  if (ctx.pageRole === "nav" || ctx.pageRole === "header" || ctx.pageRole === "footer") {
    reasons.push("in_site_chrome");
    score -= 0.45;
  }

  if (NEGATIVE_EXACT.test(name)) {
    return {
      accepted: false,
      confidence: 0.95,
      reasons: ["negative_exact_nav_or_section_heading"],
      metadata,
    };
  }

  if (NEGATIVE_NAME.test(name)) {
    return {
      accepted: false,
      confidence: 0.9,
      reasons: ["negative_facility_or_procedural_name"],
      metadata,
    };
  }

  // Surrounding soft negatives: penalty only, not absolute reject
  if (SOFT_SURROUND_NEGATIVE.test(ctx.surroundingText ?? "")) {
    score -= 0.15;
    reasons.push("soft_procedural_surround");
  }

  if (ctx.href && NEGATIVE_HREF.test(ctx.href)) {
    return {
      accepted: false,
      confidence: 0.85,
      reasons: ["negative_href_procedural"],
      metadata,
    };
  }

  if (
    /^(how to|newly admitted|graduate student|family student|undergraduate|visiting|optional|temporary|summer |spring |winter |medical|dates)/i.test(
      name
    )
  ) {
    return {
      accepted: false,
      confidence: 0.9,
      reasons: ["negative_procedural_title"],
      metadata,
    };
  }

  const onHousingPage = ctx.pageRoles.some((r) =>
    ["housing_landing", "housing_directory", "housing_detail", "rates", "room_type"].includes(r)
  );
  if (!onHousingPage) {
    return { accepted: false, confidence: 0.2, reasons: ["not_on_housing_page"], metadata };
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

  // Menu-item / chrome repeated links are weak; real cards are strong
  if (ctx.selectorType === "li.menu-item" || ctx.pageRole === "nav") {
    score -= 0.25;
    reasons.push("menu_or_nav_structure_penalty");
  } else if (ctx.inRepeatedStructure && (strongName || strongSurround)) {
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

  if (
    !strongName &&
    ctx.inRepeatedStructure &&
    strongSurround &&
    /^[A-Z][A-Za-z0-9 .'&\-]{2,60}$/.test(name) &&
    ctx.pageRole !== "nav"
  ) {
    score += 0.35;
    reasons.push("proper_name_in_housing_card_with_evidence");
  }

  if (/\b(school of|college of|department|center for|institute)\b/i.test(name) && !strongSurround) {
    score -= 0.4;
    reasons.push("academic_name_without_strong_housing_context");
  }

  // Headings need nearby housing structure — bare page headings alone are weak
  if (ctx.structuralRole === "heading" && !ctx.inRepeatedStructure && !strongSurround) {
    score -= 0.2;
    reasons.push("heading_without_housing_structure");
  }

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
    metadata,
  };
}
