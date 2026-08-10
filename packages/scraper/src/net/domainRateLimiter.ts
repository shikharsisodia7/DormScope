/**
 * Per-domain rate limiting for scraper fetches.
 * Conservative defaults: 1 concurrent request per host, min spacing between requests.
 */
export class DomainRateLimiter {
  private lastAt = new Map<string, number>();
  private inflight = new Map<string, number>();
  private backoffUntil = new Map<string, number>();

  constructor(
    private opts: { minSpacingMs: number; maxConcurrentPerDomain: number } = {
      minSpacingMs: 800,
      maxConcurrentPerDomain: 1,
    }
  ) {}

  backoff(host: string, ms: number) {
    const key = (host || "unknown").toLowerCase();
    const until = Date.now() + ms;
    const prev = this.backoffUntil.get(key) ?? 0;
    this.backoffUntil.set(key, Math.max(prev, until));
  }

  async acquire(host: string): Promise<() => void> {
    const key = (host || "unknown").toLowerCase();
    for (;;) {
      const now = Date.now();
      const until = this.backoffUntil.get(key) ?? 0;
      const inflight = this.inflight.get(key) ?? 0;
      const last = this.lastAt.get(key) ?? 0;
      const waitBackoff = Math.max(0, until - now);
      const waitSpacing = last > 0 ? Math.max(0, this.opts.minSpacingMs - (now - last)) : 0;
      if (inflight < this.opts.maxConcurrentPerDomain && waitBackoff === 0 && waitSpacing === 0) {
        this.inflight.set(key, inflight + 1);
        this.lastAt.set(key, Date.now());
        return () => {
          this.inflight.set(key, Math.max(0, (this.inflight.get(key) ?? 1) - 1));
        };
      }
      await new Promise((r) => setTimeout(r, Math.max(waitBackoff, waitSpacing, 40)));
    }
  }
}
