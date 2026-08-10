import { describe, expect, it } from "vitest";
import {
  classifyHousingCandidate,
  classifyPageRoles,
  classifyPageRolesFromSignals,
} from "./classifyHousing";
import { parseHousingHtmlDetailed } from "./parsePage";

describe("classifyPageRoles", () => {
  it("detects housing directory pages", () => {
    const roles = classifyPageRoles(
      "https://housing.example.edu/explore-housing-options/residence-halls/",
      "Explore housing options and residence halls on campus"
    );
    expect(roles).toContain("housing_directory");
  });

  it("does not treat apply pages as directories from body housing mentions", () => {
    const roles = classifyPageRolesFromSignals({
      url: "https://housing.example.edu/how-to-apply/",
      title: "How to Apply for Housing",
      h1: "How to Apply for Housing",
      bodySample: "Residence halls are available. Apply for housing online. Dining hall hours.",
    });
    expect(roles).toContain("application");
    expect(roles).not.toContain("housing_directory");
  });
});

describe("classifyHousingCandidate", () => {
  it("accepts Unit 1 on an official housing directory without requiring Hall", () => {
    const result = classifyHousingCandidate("Unit 1", {
      pageUrl: "https://housing.berkeley.edu/explore-housing-options/residence-halls/",
      pageRoles: ["housing_directory"],
      href: "https://housing.berkeley.edu/explore-housing-options/residence-halls/unit-1/",
      inRepeatedStructure: true,
      structuralRole: "link",
      surroundingText: "Residence halls Unit 1 living community",
      pageRole: "main",
    });
    expect(result.accepted).toBe(true);
    expect(result.entityKindHint).toBe("UNIT");
  });

  it("rejects Dining Hall even on a housing-related page", () => {
    const result = classifyHousingCandidate("Dining Hall", {
      pageUrl: "https://housing.example.edu/",
      pageRoles: ["housing_landing"],
      surroundingText: "Campus dining hall hours",
      structuralRole: "heading",
    });
    expect(result.accepted).toBe(false);
    expect(result.reasons.some((r) => r.startsWith("negative_"))).toBe(true);
  });

  it("does not reject Swig Hall merely because description mentions dining hall", () => {
    const result = classifyHousingCandidate("Swig Hall", {
      pageUrl: "https://www.scu.edu/housing/residence-halls/",
      pageRoles: ["housing_directory"],
      surroundingText: "Swig Hall — located near Benson dining hall and the library",
      inRepeatedStructure: true,
      structuralRole: "card_title",
      pageRole: "main",
    });
    expect(result.accepted).toBe(true);
  });

  it("rejects Housing Application as a candidate name", () => {
    const result = classifyHousingCandidate("Housing Application", {
      pageUrl: "https://housing.example.edu/",
      pageRoles: ["housing_landing"],
      surroundingText: "Apply online",
    });
    expect(result.accepted).toBe(false);
  });

  it("keeps Unit 1 valid when description mentions meal plan required", () => {
    const result = classifyHousingCandidate("Unit 1", {
      pageUrl: "https://housing.berkeley.edu/residence-halls/unit-1/",
      pageRoles: ["housing_detail"],
      surroundingText: "Unit 1 residence hall. Meal plan required for first-year residents.",
      href: "https://housing.berkeley.edu/residence-halls/unit-1/",
      structuralRole: "card_title",
      pageRole: "main",
    });
    expect(result.accepted).toBe(true);
  });

  it("rejects Residence Life section headings", () => {
    const result = classifyHousingCandidate("Residence Life", {
      pageUrl: "https://housing.example.edu/",
      pageRoles: ["housing_landing"],
      structuralRole: "heading",
    });
    expect(result.accepted).toBe(false);
  });

  it("accepts apartment community names without dorm/hall", () => {
    const result = classifyHousingCandidate("Vista del Campo", {
      pageUrl: "https://housing.uci.edu/housing-options/",
      pageRoles: ["housing_directory"],
      inRepeatedStructure: true,
      structuralRole: "card_title",
      surroundingText: "Apartment community housing option with laundry and kitchen",
      pageRole: "main",
    });
    expect(result.accepted).toBe(true);
  });
});

describe("parseHousingHtmlDetailed fixtures", () => {
  it("extracts Unit-style links and rejects Dining Hall", () => {
    const html = `
      <html><body>
        <main>
        <h1>Residence Halls</h1>
        <ul>
          <li class="card"><a href="/residence-halls/unit-1/">Unit 1</a><p>First-year residence hall living</p></li>
          <li class="card"><a href="/residence-halls/unit-2/">Unit 2</a><p>Residence hall community</p></li>
          <li class="card"><a href="/dining/dining-hall/">Dining Hall</a><p>Meal plans</p></li>
        </ul>
        </main>
      </body></html>
    `;
    const parsed = parseHousingHtmlDetailed(
      html,
      "https://housing.example.edu/explore-housing-options/residence-halls/"
    );
    const names = parsed.accepted.map((a) => a.name);
    expect(names).toContain("Unit 1");
    expect(names).toContain("Unit 2");
    expect(names).not.toContain("Dining Hall");
  });

  it("extracts village / commons style cards", () => {
    const html = `
      <html><body>
        <main>
        <h1>Housing Options</h1>
        <div class="card"><h3>Manzanita Village</h3><p>Apartment-style residential community with laundry</p></div>
        <div class="card"><h3>Martinez Commons</h3><p>Upper-division housing option</p></div>
        </main>
      </body></html>
    `;
    const parsed = parseHousingHtmlDetailed(html, "https://housing.example.edu/housing-options/");
    const names = parsed.accepted.map((a) => a.name);
    expect(names).toContain("Manzanita Village");
    expect(names).toContain("Martinez Commons");
  });

  it("ignores nav menu-item housing links as strong candidates", () => {
    const html = `
      <html><body>
        <nav><ul>
          <li class="menu-item"><a href="/housing/residence-halls/swig/">Swig Hall</a></li>
          <li class="menu-item"><a href="/housing/residence-halls/casa/">Casa Italiana</a></li>
          <li class="menu-item"><a href="/housing/apply/">Apply</a></li>
        </ul></nav>
        <main><p>Welcome to housing. Please browse residence halls from the directory.</p></main>
      </body></html>
    `;
    const parsed = parseHousingHtmlDetailed(html, "https://housing.example.edu/");
    expect(parsed.accepted.length).toBe(0);
  });

  it("detects no_ac amenity from explicit negative text", () => {
    const html = `
      <html><body><main>
        <div class="card"><h3>North Hall</h3><p>Residence hall community. No air conditioning. Laundry on site.</p></div>
        <div class="card"><h3>South Hall</h3><p>Residence hall community with air conditioning.</p></div>
        <div class="card"><h3>East Hall</h3><p>Residence hall living option.</p></div>
      </main></body></html>
    `;
    const parsed = parseHousingHtmlDetailed(html, "https://housing.example.edu/residence-halls/");
    const north = parsed.accepted.find((a) => a.name === "North Hall");
    expect(north?.amenities).toContain("no_ac");
    const south = parsed.accepted.find((a) => a.name === "South Hall");
    expect(south?.amenities).toContain("ac");
  });
});
