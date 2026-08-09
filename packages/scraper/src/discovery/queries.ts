export function housingSearchQueries(collegeName: string): string[] {
  return [
    `${collegeName} housing`,
    `${collegeName} residence halls`,
    `${collegeName} dorms`,
    `${collegeName} housing rates`,
    `${collegeName} residence life`,
    `${collegeName} room and board`,
    `${collegeName} housing PDF`,
    `${collegeName} campus housing map`,
  ];
}

export function isOfficialDomain(url: string, collegeDomain: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const official = collegeDomain.replace(/^www\./, "");
    // housing.berkeley.edu is official relative to berkeley.edu
    if (host === official || host.endsWith(`.${official}`)) return true;
    // Allow sibling housing.* when college is www.school.edu → school.edu
    const root = official.split(".").slice(-2).join(".");
    if (root && (host === root || host.endsWith(`.${root}`))) return true;
    return false;
  } catch {
    return false;
  }
}

export function extractDomain(websiteUrl?: string | null): string {
  if (!websiteUrl) return "";
  try {
    return new URL(websiteUrl).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function extractRegistrableDomain(websiteUrl?: string | null): string {
  const host = extractDomain(websiteUrl);
  if (!host) return "";
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  // Simple eTLD+1 for .edu / .com / .org
  return parts.slice(-2).join(".");
}

/** Candidate housing URLs derived from the institution website (no network). */
export function guessHousingCandidateUrls(websiteUrl?: string | null, housingUrl?: string | null): string[] {
  const urls: string[] = [];
  if (housingUrl) urls.push(housingUrl);

  const root = extractRegistrableDomain(websiteUrl);
  if (root) {
    urls.push(`https://housing.${root}/`);
    urls.push(`https://www.housing.${root}/`);
    urls.push(`https://reslife.${root}/`);
    urls.push(`https://residentiallife.${root}/`);
    urls.push(`https://residence.${root}/`);
  }

  if (websiteUrl) {
    const base = websiteUrl.replace(/\/$/, "");
    const pathHints = [
      "/housing",
      "/housing/",
      "/residence-life",
      "/residence-life/",
      "/residential-life",
      "/residential-life/",
      "/student-life/housing",
      "/campus-life/housing",
      "/living",
      "/living/",
      "/reslife",
      "/residences",
      "/explore-housing-options/residence-halls/",
      "/housing/residence-halls/",
      "/housing/residences/",
    ];
    for (const path of pathHints) {
      urls.push(`${base}${path}`);
    }
  }

  return Array.from(new Set(urls));
}
