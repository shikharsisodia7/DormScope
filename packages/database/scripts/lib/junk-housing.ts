/**
 * Generic junk housing name detection — no school-specific allowlists.
 */

const HOUSING_TERMS =
  /\b(hall|house|houses|quad|tower|villa|residence|dorm|commons|apartment|village|manor|lodge|court|inn|complex|suite|community|building|residential|terrace|place|center|centre|garden|crossing|pointe|heights|view|views|college|unit)\b/i;

const JUNK_NAV =
  /\b(faq|faqs|how to|contact|policy|policies|terms|conditions|apply|move-in|move-out|checklist|parking|dining|meal|health|safety|deadline|deadlines|cancellation|appeal|staff|news|event|guarantee|task force|bridge program|edge programs?|newly admitted|visiting scholar|furniture leasing|compare housing|housing by user|rates, contracts|cancellations|technology|cleaning|mail service|winter break|living with|living sustainably|front desks?|my room|tours|optional apartment cleaning|bed bugs|missing student|assignment process|how to read|renewals|accommodations|dates\s*(&|and)\s*deadlines|spring housing|summer |off-campus|resources|services|support|handbook|forms|calendar|events|announcements|maintenance|billing|payment|insurance|wellness|counseling|accessibility|conduct|community standards|housing fair|relocation|benefits|welcome to|why choose|options to suit|features include|graduate residence chart|residence chart|residence agreement|room selection|canceling your|window coverings|high-speed internet|on-site professional)\b/i;

/** CTA-only names (must start with CTA) — do not quarantine "Explore Aggie Village" style if housing terms present after CTA. */
const JUNK_CTA_EXACT =
  /^(click here|learn more|read more|sign up|log in|view all|see all|get started|download|submit|register|apply now|book now|schedule a tour)$/i;

const JUNK_CTA_PREFIX =
  /^(explore|discover|find out)\s+/i;

const JUNK_PROCEDURAL =
  /^(how|what|when|where|why|step \d|chapter \d|section \d|overview of|introduction to|guide to|information about)\b/i;

export type JunkReason =
  | "empty_name"
  | "nav_or_policy_label"
  | "cta_phrase"
  | "procedural_title"
  | "sentence_length_name"
  | "long_non_housing_name";

export interface JunkAssessment {
  isJunk: boolean;
  reason: JunkReason | null;
}

export function isSentenceLikeName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length > 45) return true;
  // Periods in initials (John R. Lewis) are OK; sentence punctuation is not
  if (/[!?;:]/.test(trimmed)) return true;
  if (/\.\s+[A-Z]/.test(trimmed)) return true;
  if (trimmed.split(/\s+/).length > 8) return true;
  return false;
}

export function assessHousingName(name: string): JunkAssessment {
  const trimmed = name.trim();
  if (!trimmed) return { isJunk: true, reason: "empty_name" };
  if (JUNK_NAV.test(trimmed)) return { isJunk: true, reason: "nav_or_policy_label" };
  if (JUNK_CTA_EXACT.test(trimmed)) return { isJunk: true, reason: "cta_phrase" };
  // "Explore Residences" / "Explore Patton Hall" — CTA prefix without being a real entity name alone
  if (JUNK_CTA_PREFIX.test(trimmed)) return { isJunk: true, reason: "cta_phrase" };
  if (JUNK_PROCEDURAL.test(trimmed)) return { isJunk: true, reason: "procedural_title" };
  if (isSentenceLikeName(trimmed) && !HOUSING_TERMS.test(trimmed)) {
    return { isJunk: true, reason: "sentence_length_name" };
  }
  if (!HOUSING_TERMS.test(trimmed) && trimmed.length > 40) {
    return { isJunk: true, reason: "long_non_housing_name" };
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
