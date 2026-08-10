// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

// Mock Prisma and Clerk so importing data.ts and admin-auth doesn't fail.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

// Import directly from the source file to avoid Vite CJS barrel-export interop issues.
// The shared package exports via `canonicalUrl` (the function name), and extended utilities.
import {
  canonicalUrl,
  canonicalizeUrl,
  resolvedUrl,
  compareSourceRoles,
  sourceRoleLabel,
} from "../../../../packages/shared/src/utils/canonicalUrl";
import { mergeSources } from "@/lib/data";

describe("canonicalUrl", () => {
  it("strips utm_* tracking params", () => {
    const result = canonicalUrl(
      "https://example.edu/housing?utm_source=email&utm_campaign=spring"
    );
    expect(result).toBe("https://example.edu/housing");
  });

  it("strips fbclid and gclid", () => {
    const result = canonicalUrl(
      "https://example.edu/housing?fbclid=abc123&gclid=xyz"
    );
    expect(result).toBe("https://example.edu/housing");
  });

  it("strips URL fragment", () => {
    const result = canonicalUrl("https://example.edu/housing#section2");
    expect(result).toBe("https://example.edu/housing");
  });

  it("lowercases host", () => {
    const result = canonicalUrl("https://Housing.Example.EDU/dorms");
    expect(result).toBe("https://housing.example.edu/dorms");
  });

  it("strips trailing slash from non-root paths", () => {
    const result = canonicalUrl("https://example.edu/housing/");
    expect(result).toBe("https://example.edu/housing");
  });

  it("preserves root slash", () => {
    const result = canonicalUrl("https://example.edu/");
    expect(result).toBe("https://example.edu/");
  });

  it("treats same URL with different tracking params as equal", () => {
    const a = canonicalUrl(
      "https://housing.mit.edu/apply?utm_source=email&utm_campaign=spring"
    );
    const b = canonicalUrl(
      "https://housing.mit.edu/apply?utm_medium=social&gclid=123"
    );
    expect(a).toBe(b);
  });
});

describe("canonicalizeUrl (null-safe wrapper)", () => {
  it("returns empty string for null", () => {
    expect(canonicalizeUrl(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(canonicalizeUrl(undefined)).toBe("");
  });

  it("canonicalizes a valid URL", () => {
    const result = canonicalizeUrl(
      "https://example.edu/housing?utm_source=email"
    );
    expect(result).toBe("https://example.edu/housing");
  });
});

describe("resolvedUrl", () => {
  it("returns finalUrl when different from raw", () => {
    expect(resolvedUrl("http://t.co/abc", "https://example.edu/housing")).toBe(
      "https://example.edu/housing"
    );
  });

  it("returns raw URL when finalUrl is the same", () => {
    const url = "https://example.edu/housing";
    expect(resolvedUrl(url, url)).toBe(url);
  });

  it("returns canonicalUrl when finalUrl is null", () => {
    expect(resolvedUrl("http://t.co/abc", null, "https://example.edu/housing")).toBe(
      "https://example.edu/housing"
    );
  });

  it("returns raw URL when both finalUrl and canonicalUrl are null", () => {
    expect(resolvedUrl("https://example.edu", null, null)).toBe("https://example.edu");
  });
});

describe("compareSourceRoles", () => {
  it("orders detail before directory", () => {
    expect(compareSourceRoles("detail", "directory")).toBeLessThan(0);
  });

  it("orders directory before rates", () => {
    expect(compareSourceRoles("directory", "rates")).toBeLessThan(0);
  });

  it("orders rates before eligibility", () => {
    expect(compareSourceRoles("rates", "eligibility")).toBeLessThan(0);
  });

  it("orders eligibility before other/unknown", () => {
    expect(compareSourceRoles("eligibility", null)).toBeLessThan(0);
  });

  it("treats equal roles as equal", () => {
    expect(compareSourceRoles("detail", "detail")).toBe(0);
    expect(compareSourceRoles(null, undefined)).toBe(0);
  });
});

describe("sourceRoleLabel", () => {
  it("returns correct label for detail", () => {
    expect(sourceRoleLabel("detail")).toBe("Official detail page");
  });
  it("returns correct label for directory", () => {
    expect(sourceRoleLabel("directory")).toBe("Official housing directory");
  });
  it("returns correct label for rates", () => {
    expect(sourceRoleLabel("rates")).toBe("Housing rates / costs");
  });
  it("returns correct label for eligibility", () => {
    expect(sourceRoleLabel("eligibility")).toBe("Eligibility information");
  });
  it("returns generic label for unknown role", () => {
    expect(sourceRoleLabel(null)).toBe("Housing page");
    expect(sourceRoleLabel("other")).toBe("Housing page");
  });
});

// ─── mergeSources (source deduplication logic) ───────────────────────────────

function makeSource(
  id: string,
  url: string,
  role: string | null = null,
  title: string | null = null,
  created = "2024-01-01",
  canonical: string | null = null
) {
  return {
    id,
    url,
    finalUrl: null as string | null,
    canonicalUrl: canonical,
    title,
    sourceType: "OFFICIAL_WEBSITE",
    isApproved: true,
    pageRole: role,
    createdAt: new Date(created),
  };
}

describe("mergeSources", () => {
  it("deduplicates sources with the same canonical URL", () => {
    const legacy = [makeSource("s1", "https://housing.example.edu/dorms?utm_source=email", null, null, "2024-01-01", "https://housing.example.edu/dorms")];
    const fromDormSources = [
      {
        role: "directory",
        source: makeSource("s2", "https://housing.example.edu/dorms?gclid=123", "directory", "Housing Directory", "2024-01-02", "https://housing.example.edu/dorms"),
      },
    ];

    const merged = mergeSources(legacy, fromDormSources);
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe("Housing Directory");
  });

  it("orders detail before directory before rates", () => {
    const legacy = [makeSource("rates", "https://housing.example.edu/rates", "rates", null, "2024-03-01")];
    const fromDormSources = [
      { role: "directory", source: makeSource("dir", "https://housing.example.edu/directory", "directory", null, "2024-02-01") },
      { role: "detail", source: makeSource("det", "https://housing.example.edu/detail", "detail", null, "2024-01-01") },
    ];

    const merged = mergeSources(legacy, fromDormSources);
    expect(merged.map((s) => s.id)).toEqual(["det", "dir", "rates"]);
  });

  it("preserves sources with distinct canonical URLs", () => {
    const legacy = [makeSource("a", "https://housing.example.edu/dorms", "directory")];
    const fromDormSources = [
      { role: "detail", source: makeSource("b", "https://housing.example.edu/smith-hall", "detail") },
    ];

    const merged = mergeSources(legacy, fromDormSources);
    expect(merged).toHaveLength(2);
  });

  it("uses finalUrl as display URL when available", () => {
    const legacy = [{ ...makeSource("s1", "http://redirect.example.com/x"), finalUrl: "https://housing.example.edu/real" }];
    const merged = mergeSources(legacy, []);
    expect(merged[0].url).toBe("https://housing.example.edu/real");
  });
});
