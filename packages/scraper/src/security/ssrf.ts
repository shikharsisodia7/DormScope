import { lookup } from "dns/promises";
import { isIP } from "net";

export class SafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafeUrlError";
  }
}

export interface SafeUrlOptions {
  /** Skip DNS resolution (only syntactic / literal-IP checks). Default false. */
  skipDns?: boolean;
  /** Allow http in addition to https. Default true. */
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
    [ipv4ToInt("169.254.0.0"), ipv4ToInt("169.254.255.255")], // link-local + AWS metadata
    [ipv4ToInt("172.16.0.0"), ipv4ToInt("172.31.255.255")],
    [ipv4ToInt("192.168.0.0"), ipv4ToInt("192.168.255.255")],
    [ipv4ToInt("100.64.0.0"), ipv4ToInt("100.127.255.255")], // CGNAT
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
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("ff")) return true; // multicast
  // IPv4-mapped
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

/**
 * Returns true when URL is http(s) and does not resolve to private/reserved addresses.
 */
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

  // Explicit metadata IP check (also covered by 169.254/16)
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
