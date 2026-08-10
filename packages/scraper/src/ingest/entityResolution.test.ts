import { describe, expect, it } from "vitest";
import { safeSameEntity } from "./entityResolution";

describe("safeSameEntity", () => {
  it("does not merge Unit 1 with Unit 2", () => {
    expect(safeSameEntity("Unit 1", "Unit 2")).toBe(false);
  });

  it("does not merge Jester East with Jester West", () => {
    expect(safeSameEntity("Jester East", "Jester West")).toBe(false);
  });

  it("does not merge North Hall with South Hall", () => {
    expect(safeSameEntity("North Hall", "South Hall")).toBe(false);
  });

  it("does not merge Building 1 with Building 10", () => {
    expect(safeSameEntity("Building 1", "Building 10")).toBe(false);
  });

  it("merges Unit One with Unit 1", () => {
    expect(safeSameEntity("Unit One", "Unit 1")).toBe(true);
  });

  it("merges McLaughlin Walsh with McLaughlin-Walsh", () => {
    expect(safeSameEntity("McLaughlin Walsh", "McLaughlin-Walsh")).toBe(true);
  });
});
