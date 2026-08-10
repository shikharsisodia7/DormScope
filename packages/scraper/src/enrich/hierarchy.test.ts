import { describe, expect, it } from "vitest";
import { HousingEntityKind } from "@prisma/client";
import { suggestHierarchy } from "./hierarchy";

describe("suggestHierarchy", () => {
  it("links buildings under a village from category label", () => {
    const suggestions = suggestHierarchy([
      {
        id: "p1",
        name: "Residential Village",
        entityKind: HousingEntityKind.VILLAGE,
        parentHousingId: null,
      },
      {
        id: "c1",
        name: "Building A",
        entityKind: HousingEntityKind.BUILDING,
        parentHousingId: null,
        officialCategoryLabel: "Residential Village",
      },
      {
        id: "c2",
        name: "Building B",
        entityKind: HousingEntityKind.BUILDING,
        parentHousingId: null,
        officialCategoryLabel: "Residential Village",
      },
    ]);
    expect(suggestions).toHaveLength(2);
    expect(suggestions.every((s) => s.parentId === "p1")).toBe(true);
  });

  it("links via part of phrase", () => {
    const suggestions = suggestHierarchy([
      {
        id: "u1",
        name: "Unit 1",
        entityKind: HousingEntityKind.UNIT,
        parentHousingId: null,
      },
      {
        id: "ch",
        name: "Christian Hall",
        entityKind: HousingEntityKind.BUILDING,
        parentHousingId: null,
        description: "Christian Hall is part of Unit 1 residence community",
      },
    ]);
    expect(suggestions.some((s) => s.childId === "ch" && s.parentId === "u1")).toBe(true);
  });

  it("does not invent hierarchy without evidence", () => {
    const suggestions = suggestHierarchy([
      {
        id: "a",
        name: "Swig Hall",
        entityKind: HousingEntityKind.BUILDING,
        parentHousingId: null,
      },
      {
        id: "b",
        name: "Casa Italiana",
        entityKind: HousingEntityKind.BUILDING,
        parentHousingId: null,
      },
    ]);
    expect(suggestions).toHaveLength(0);
  });
});
