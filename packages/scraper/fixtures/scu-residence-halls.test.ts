import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import { parseHousingHtmlDetailed } from "../src/html/parsePage";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("SCU residence halls fixture precision", () => {
  const html = readFileSync(join(__dirname, "scu-residence-halls.html"), "utf8");
  const parsed = parseHousingHtmlDetailed(
    html,
    "https://www.scu.edu/housing/residence-halls/"
  );

  it("retains legitimate SCU halls", () => {
    const names = parsed.accepted.map((a) => a.name);
    expect(names).toContain("Swig Hall");
    expect(names).toContain("Casa Italiana");
    expect(names).toContain("Graham Residence Hall");
    expect(names).toContain("Campisi Hall");
  });

  it("rejects nav/procedural false positives", () => {
    const names = parsed.accepted.map((a) => a.name.toLowerCase());
    expect(names.some((n) => n.includes("apply"))).toBe(false);
    expect(names.some((n) => n.includes("meal"))).toBe(false);
    expect(names.some((n) => n.includes("faq"))).toBe(false);
    expect(names.some((n) => n === "housing")).toBe(false);
    expect(names.some((n) => n.includes("dining hall"))).toBe(false);
    expect(names.some((n) => n.includes("policies"))).toBe(false);
  });

  it("keeps Swig Hall despite dining hall mention in description", () => {
    expect(parsed.accepted.some((a) => a.name === "Swig Hall")).toBe(true);
  });

  it("does not accept more than a small handful of entities from this fixture", () => {
    // Fixture has exactly 4 halls — allow tiny slack for heading variants
    expect(parsed.accepted.length).toBeLessThanOrEqual(6);
    expect(parsed.accepted.length).toBeGreaterThanOrEqual(4);
  });
});
