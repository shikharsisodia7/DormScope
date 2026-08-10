/**
 * Tracking/analytics query parameters to strip during URL canonicalization.
 * Stripping these ensures the same content page is not stored as multiple sources.
 */
const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "msclkid",
  "mc_eid",
  "mc_cid",
  "_ga",
  "_gl",
  "ref",
  "source",
  "campaign",
  "yclid",
  "dclid",
  "gbraid",
  "wbraid",
  "twclid",
  "li_fat_id",
  "igshid",
  "ttclid",
  "rdt_cid",
  "ScCid",
]);

/**
 * Normalize a URL for source deduplication:
 * - Lowercase the host
 * - Strip fragment (#...)
 * - Strip known tracking/analytics query parameters (UTM, fbclid, gclid, etc.)
 * - Remove trailing slashes from the path (except root "/")
 *
 * Returns the normalized URL string. If parsing fails, returns the input lowercased.
 */
export function canonicalUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl.toLowerCase().trim();
  }

  // Lowercase host
  url.hostname = url.hostname.toLowerCase();

  // Strip fragment
  url.hash = "";

  // Strip tracking params
  const params = new URLSearchParams(url.search);
  const toDelete: string[] = [];
  for (const key of Array.from(params.keys())) {
    if (TRACKING_PARAMS.has(key) || TRACKING_PARAMS.has(key.toLowerCase())) {
      toDelete.push(key);
    }
  }
  for (const key of toDelete) {
    params.delete(key);
  }
  url.search = params.toString();

  // Strip trailing slashes from path (preserve root "/")
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}

/**
 * Null-safe wrapper around `canonicalUrl`. Returns "" for null/undefined input.
 */
export function canonicalizeUrl(raw: string | null | undefined): string {
  if (!raw) return "";
  return canonicalUrl(raw.trim());
}

/**
 * Preferred display URL: use finalUrl if it differs from the raw url,
 * then canonicalUrl, otherwise fall back to the raw url.
 */
export function resolvedUrl(
  raw: string,
  finalUrl?: string | null,
  canonicalUrlValue?: string | null
): string {
  if (finalUrl && finalUrl !== raw) return finalUrl;
  if (canonicalUrlValue && canonicalUrlValue !== raw) return canonicalUrlValue;
  return raw;
}

/** Role ordering for display: detail first, then directory, rates, eligibility, other. */
const ROLE_ORDER: Record<string, number> = {
  detail: 0,
  directory: 1,
  rates: 2,
  eligibility: 3,
};

/** Compare two source pageRole strings for sort order. */
export function compareSourceRoles(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const aRank = ROLE_ORDER[a ?? ""] ?? 4;
  const bRank = ROLE_ORDER[b ?? ""] ?? 4;
  return aRank - bRank;
}

/** Human-readable label for a source's pageRole field. */
export function sourceRoleLabel(role: string | null | undefined): string {
  switch (role) {
    case "detail":
      return "Official detail page";
    case "directory":
      return "Official housing directory";
    case "rates":
      return "Housing rates / costs";
    case "eligibility":
      return "Eligibility information";
    default:
      return "Housing page";
  }
}
