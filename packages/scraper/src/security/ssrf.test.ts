import { describe, expect, it } from "vitest";
import { canonicalizeUrl } from "./ssrf";

describe("canonicalizeUrl", () => {
  it("strips tracking params and trailing slash", () => {
    expect(canonicalizeUrl("https://HOUSING.Example.EDU/halls/?utm_source=x#frag")).toBe(
      "https://housing.example.edu/halls"
    );
  });
});
