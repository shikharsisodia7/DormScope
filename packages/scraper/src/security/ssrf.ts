import { lookup } from "dns/promises";
import { isIP } from "net";

export class SafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafeUrlError";
  }
}

export interface SafeUrlOptions {
  skipDns?: boolean;
  allowHttp?: boolean;
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
}

function isPrivateOrReservedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  const ranges: Array<[number, number]> = [
    [ipv4ToInt("0.0.0.0"), ipv4ToInt("0.255.255.255")],
    [ipv4ToInt("10.0.0.0"), ipv4ToInt("10.255.255.255")],
    [ipv4ToInt("127.0.0.0"), ipv4ToInt("127.255.255.255")],
    [ipv4ToInt("169.254.0.0"), ipv4ToInt("169.254.255.255")],
    [ipv4ToInt("172.16.0.0"), ipv4ToInt("172.31.255.255")],
    [ipv4ToInt("192.168.0.0"), ipv4ToInt("192.168.255.255")],
    [ipv4ToInt("100.64.0.0"), ipv4ToInt("100.127.255.255")],
    [ipv4ToInt("192.0.0.0"), ipv4ToInt("192.0.0.255")],
    [ipv4ToInt("192.0.2.0"), ipv4ToInt("192.0.2.255")],
    [ipv4ToInt("198.18.0.0"), ipv4ToInt("198.19.255.255")],
    [ipv4ToInt("198.51.100.0"), ipv4ToInt("198.51.100.255")],
    [ipv4ToInt("203.0.113.0"), ipv4ToInt("203.0.113.255")],
    [ipv4ToInt("224.0.0.0"), ipv4ToInt("255.255.255.255")],
  ];
  return ranges.some(([lo, hi]) => n >= lo && n <= hi);
}

function isPrivateOrReservedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("fe80")) return true;
  if (lower.startsWith("ff")) return true;
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.slice("::ffff:".length);
    if (isIP(v4) === 4) return isPrivateOrReservedIpv4(v4);
  }
  return false;
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    host === "localhost" ||
    host === "metadata" ||
    host === "metadata.google.internal" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }
  const version = isIP(host);
  if (version === 4) return isPrivateOrReservedIpv4(host);
  if (version === 6) return isPrivateOrReservedIpv6(host);
  return false;
}

export async function isSafeUrl(raw: string, options: SafeUrlOptions = {}): Promise<boolean> {
  try {
    await assertSafeUrl(raw, options);
    return true;
  } catch {
    return false;
  }
}

export async function assertSafeUrl(raw: string, options: SafeUrlOptions = {}): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeUrlError("Invalid URL");
  }

  const allowHttp = options.allowHttp !== false;
  if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
    throw new SafeUrlError("Only http(s) URLs are allowed");
  }

  if (url.username || url.password) {
    throw new SafeUrlError("URLs with credentials are not allowed");
  }

  if (isBlockedHost(url.hostname)) {
    throw new SafeUrlError("Blocked host / private address");
  }

  if (url.hostname === "169.254.169.254") {
    throw new SafeUrlError("Blocked cloud metadata address");
  }

  if (!options.skipDns && isIP(url.hostname) === 0) {
    try {
      const results = await lookup(url.hostname, { all: true });
      for (const r of results) {
        if (r.family === 4 && isPrivateOrReservedIpv4(r.address)) {
          throw new SafeUrlError(`DNS resolved to private IPv4: ${r.address}`);
        }
        if (r.family === 6 && isPrivateOrReservedIpv6(r.address)) {
          throw new SafeUrlError(`DNS resolved to private IPv6: ${r.address}`);
        }
      }
    } catch (err) {
      if (err instanceof SafeUrlError) throw err;
      throw new SafeUrlError(`DNS resolution failed for ${url.hostname}`);
    }
  }

  return url;
}

export function canonicalizeUrl(raw: string): string {
  const u = new URL(raw);
  u.hash = "";
  // strip common tracking params
  for (const key of Array.from(u.searchParams.keys())) {
    if (/^(utm_|fbclid|gclid|mc_)/i.test(key)) u.searchParams.delete(key);
  }
  u.hostname = u.hostname.toLowerCase();
  let path = u.pathname.replace(/\/+$/, "") || "/";
  return `${u.protocol}//${u.hostname}${path}${u.search}`;
}

export interface SafeFetchResult {
  html: string | null;
  finalUrl: string;
  status: number;
  contentHash?: string;
  retryAfterMs?: number;
  headers?: Record<string, string>;
}

const MAX_HTML_BYTES = Number(process.env.SCRAPER_MAX_HTML_BYTES ?? 5_000_000);

export function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 24 * 60 * 60 * 1000);
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, Math.min(date - Date.now(), 24 * 60 * 60 * 1000));
  return undefined;
}

/**
 * Fetch HTML while validating every redirect hop against SSRF rules.
 */
export async function fetchHtmlSafe(
  rawUrl: string,
  options: {
    userAgent?: string;
    maxRedirects?: number;
    timeoutMs?: number;
    maxBytes?: number;
  } = {}
): Promise<SafeFetchResult> {
  const maxRedirects = options.maxRedirects ?? 5;
  const maxBytes = options.maxBytes ?? MAX_HTML_BYTES;
  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertSafeUrl(current);
    const res = await fetch(current, {
      headers: {
        "User-Agent":
          options.userAgent ??
          "Mozilla/5.0 (compatible; DormScopeBot/1.3; +https://dormscope-six.vercel.app; research)",
        Accept: "text/html,application/xhtml+xml,application/pdf",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs ?? 25000),
    });

    const headerMap: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headerMap[k.toLowerCase()] = v;
    });
    const retryAfterMs = parseRetryAfter(res.headers.get("retry-after"));

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("location");
      if (!loc) {
        return { html: null, finalUrl: current, status: res.status, headers: headerMap, retryAfterMs };
      }
      const next = new URL(loc, current).toString();
      await assertSafeUrl(next);
      current = next;
      continue;
    }

    if (!res.ok) {
      return {
        html: null,
        finalUrl: current,
        status: res.status,
        headers: headerMap,
        retryAfterMs,
      };
    }
    const ct = res.headers.get("content-type") ?? "";
    if (ct && !/html|text|xml|json|pdf/i.test(ct)) {
      return { html: null, finalUrl: res.url || current, status: res.status, headers: headerMap };
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) {
      return {
        html: null,
        finalUrl: res.url || current,
        status: res.status,
        headers: headerMap,
      };
    }
    const html = buf.toString("utf8");
    const { createHash } = await import("crypto");
    const contentHash = createHash("sha256").update(html).digest("hex").slice(0, 32);
    return {
      html,
      finalUrl: res.url || current,
      status: res.status,
      contentHash,
      headers: headerMap,
      retryAfterMs,
    };
  }
  throw new SafeUrlError("Too many redirects");
}
