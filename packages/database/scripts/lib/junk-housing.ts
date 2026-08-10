/**
 * Generic junk housing name detection — no school-specific allowlists.
 */

const HOUSING_TERMS =
  /\b(hall|house|houses|quad|tower|villa|residence|dorm|commons|apartment|village|manor|lodge|court|inn|complex|suite|community|building|residential|terrace|place|center|centre|garden|crossing|pointe|heights|view|views|college|unit)\b/i;

/** Strong proper-entity signals — used to spare real halls when other heuristics fire softly. */
const STRONG_ENTITY =
  /\b(hall|house|houses|quad|tower|villa|commons|manor|lodge|court|inn|complex|terrace)\b/i;

const JUNK_NAV =
  /\b(faq|faqs|how to|contact|policy|policies|terms|conditions|apply|application|move-in|move-out|checklist|parking|dining|meal|health|safety|deadline|deadlines|cancellation|appeal|staff|news|event|guarantee|task force|bridge program|edge programs?|newly admitted|visiting scholar|furniture leasing|compare housing|housing by user|rates, contracts|cancellations|technology|cleaning|mail service|winter break|living with|living sustainably|front desks?|my room|tours?|video tour|optional apartment cleaning|bed bugs|missing student|assignment process|how to read|renewals|accommodations|dates\s*(&|and)\s*deadlines|spring housing|summer |off-campus|resources|services|support|handbook|forms|calendar|events|announcements|maintenance|billing|payment|insurance|wellness|counseling|accessibility|conduct|community standards|housing fair|relocation|benefits|welcome to|why choose|options to suit|features include|graduate residence chart|residence chart|residence agreement|room selection|canceling your|window coverings|high-speed internet|on-site professional|projected rates|contract rates|cost of attendance|additional fees|equipment fee|furniture rental|housing amenities|housing options|apartment features|apartment layouts|room layouts|floor plans|tenancy|package|fee|fees|homepage|resident manual|\bmap\b|office of residence|residence life|leadership team|resident director|neighborhood representative|priority groups|financial hardship|commuting students|you belong|attach_money|view .* rates|description|number of units|student applicants|student experience|parents? network|student parent|gbo housing|inside your)\b/i;

/** CTA-only names (must start with CTA). */
const JUNK_CTA_EXACT =
  /^(click here|learn more|read more|sign up|log in|view all|see all|get started|download|submit|register|apply now|book now|schedule a tour|welcome new broncos|on-campus living)$/i;

const JUNK_CTA_PREFIX =
  /^(explore|discover|find out|be excited|be a big|welcome)\s+/i;

const JUNK_PROCEDURAL =
  /^(how|what|when|where|why|step \d|chapter \d|section \d|overview of|introduction to|guide to|information about|about the)\b/i;

/** Exact generic category / marketing labels that are never assignable residences. */
const JUNK_EXACT_GENERIC =
  /^(amenities|residence|apartment|apartments|commons|suites|high-rise|low-rise|high rise|low rise|apartment features|apartment layouts|apartments and suites|apartments & suites|room layouts|single graduate housing|single undergraduate housing|theme houses|greek houses|cooperative houses|self-operated houses|row houses|on-campus housing options( for \d{4}-\d{2})?|on-campus housing amenities|stanford (on-campus )?housing amenities|residences for couples without children|residences for single graduates|residences for students with children|northeast campus residence halls|south campus residence halls|southeast campus residence halls|cort package|childhood development center.*|early childhood education program|application process and tenancy|description|number of units|one-bedroom|two-bedroom|three-bedroom|one-bedroom rate|two-bedroom rate|three-bedroom rate|double occupancy room|double occupancy rooms|single occupancy room|triple occupancy room|standard double|standard double rooms|apartment double|apartment single|apartment plan|designed single|double as single|double with bath|extended double with bath|single with bath|suite double|suite single|suite triple|mini suite double|mini suite triple|mini suite extended double|mini suite double as triple|nu design single|nu double|nu single|4br apartment single|4br suite double|2 bedroom apartment single|4 bedroom apartment premium double|4 bedroom apartment premium double with bath|4 bedroom apartment regular single|single bedroom|townhouse double bedroom|townhouse single bedroom)$/i;

/**
 * Room-type / occupancy / rate inventory lines masquerading as entities.
 * Catch both "Furnished single-occupancy..." and "Bayview single-occupancy studio...".
 */
const JUNK_ROOM_TYPE_LINE =
  /\b(single-occupancy|double occupancy|triple occupancy|studio apartment|bedroom[, ]+\d*\s*bath|bedroom \(|&\s*\d\s*occupants\)|\d\s*bedroom|\dbr\b|premium double|regular single|deluxe residence hall|plaza double room|plaza triple room)\b/i;

const JUNK_RATES_LINE =
  /\b(projected rates|contract rates|rates for|\brates\b|room\s*&\s*board rates|view .* rates)\b/i;

const JUNK_CAMPUS_SECTION =
  /^(northeast campus|northest campus|south campus|southeast campus|north campus)\b/i;

export type JunkReason =
  | "empty_name"
  | "nav_or_policy_label"
  | "cta_phrase"
  | "procedural_title"
  | "sentence_length_name"
  | "long_non_housing_name"
  | "generic_category_label"
  | "room_type_listing"
  | "campus_section_label";

export interface JunkAssessment {
  isJunk: boolean;
  reason: JunkReason | null;
}

export function isSentenceLikeName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length > 45) return true;
  if (/[!?;:]/.test(trimmed)) return true;
  if (/\.\s+[A-Z]/.test(trimmed)) return true;
  if (trimmed.split(/\s+/).length > 8) return true;
  return false;
}

export function assessHousingName(name: string): JunkAssessment {
  const trimmed = name.trim();
  if (!trimmed) return { isJunk: true, reason: "empty_name" };
  if (JUNK_EXACT_GENERIC.test(trimmed)) return { isJunk: true, reason: "generic_category_label" };
  // Campus-section aliases ("South Campus Unit 1") and handbooks/requirements
  if (/^(northeast|northest|south|southeast|north)\s+campus\b/i.test(trimmed)) {
    return { isJunk: true, reason: "campus_section_label" };
  }
  if (/\b(handbook|handbooks|residency requirement|village office)\b/i.test(trimmed)) {
    return { isJunk: true, reason: "nav_or_policy_label" };
  }
  if (/\b\d\s*bath\b/i.test(trimmed) && !/^unit\s*\d/i.test(trimmed)) {
    return { isJunk: true, reason: "room_type_listing" };
  }
  if (/^standard\b.+\bapartment\b/i.test(trimmed)) {
    return { isJunk: true, reason: "room_type_listing" };
  }
  if (JUNK_ROOM_TYPE_LINE.test(trimmed)) {
    // Spare clear named halls that mention room config in a short title
    if (!(STRONG_ENTITY.test(trimmed) && trimmed.split(/\s+/).length <= 4)) {
      return { isJunk: true, reason: "room_type_listing" };
    }
  }
  // "Jack McDonald Hall 2 bedroom, 2 bath" — hall + room config → room type listing
  if (STRONG_ENTITY.test(trimmed) && /\b\d\s*bedroom\b/i.test(trimmed)) {
    return { isJunk: true, reason: "room_type_listing" };
  }
  if (JUNK_RATES_LINE.test(trimmed)) return { isJunk: true, reason: "nav_or_policy_label" };
  if (JUNK_NAV.test(trimmed)) return { isJunk: true, reason: "nav_or_policy_label" };
  if (JUNK_CTA_EXACT.test(trimmed)) return { isJunk: true, reason: "cta_phrase" };
  if (JUNK_CTA_PREFIX.test(trimmed)) return { isJunk: true, reason: "cta_phrase" };
  if (JUNK_PROCEDURAL.test(trimmed)) return { isJunk: true, reason: "procedural_title" };

  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 10 || trimmed.length > 70) {
    return { isJunk: true, reason: "sentence_length_name" };
  }
  if (isSentenceLikeName(trimmed) && !HOUSING_TERMS.test(trimmed)) {
    return { isJunk: true, reason: "sentence_length_name" };
  }
  if (!HOUSING_TERMS.test(trimmed) && trimmed.length > 40) {
    return { isJunk: true, reason: "long_non_housing_name" };
  }
  // Short non-housing labels without entity terms (e.g. "Priority Groups")
  if (!HOUSING_TERMS.test(trimmed) && wordCount <= 4 && !/\b(unit|hall|house)\b/i.test(trimmed)) {
    // Only if it looks administrative / not a proper place name with digits
    if (
      /^(student|office|resident|neighborhood|priority|financial|commuting|welcome|description|number|you |attach_|gbo|video|village office|village resident)/i.test(
        trimmed
      )
    ) {
      return { isJunk: true, reason: "nav_or_policy_label" };
    }
  }
  return { isJunk: false, reason: null };
}

export interface JunkCandidate {
  id: string;
  name: string;
  collegeId: string;
  collegeName: string;
  collegeSlug: string;
  reason: JunkReason;
}
