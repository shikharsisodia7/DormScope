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
    return host === official || host.endsWith(`.${official}`);
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
