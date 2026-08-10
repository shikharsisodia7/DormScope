import { describe, expect, it } from "vitest";
import {
  computeDormScore,
  DORMSCOPE_SCORE_VERSION,
  MIN_QUALITY_EVIDENCE,
} from "./dormScore";

describe("computeDormScore", () => {
  it("official source + name only does NOT produce high quality score", () => {
    const score = computeDormScore({
      confidenceScore: 0.95,
      dataCompletenessScore: 0.2,
    });

    expect(score.overallScore).toBeNull();
    expect(score.scoreable).toBe(false);
    expect(score.algorithmVersion).toBe(DORMSCOPE_SCORE_VERSION);
    expect(score.dataConfidenceScore).toBe(95);
    expect(score.valueScore).toBeNull();
    expect(score.comfortScore).toBeNull();
    expect(score.privacyScore).toBeNull();
    expect(score.socialScore).toBeNull();
    expect(score.convenienceScore).toBeNull();
    expect(score.freshmanFitScore).toBeNull();
    expect(score.amenityScore).toBeNull();
  });

  it("keeps unknown subscores null", () => {
    const score = computeDormScore({
      yearlyCost: 14000,
      collegeAvgCost: 15000,
      hasAC: null,
      bathroomStyle: null,
      privacyRating: null,
      socialVibe: null,
      quietVibe: null,
      freshmanEligible: null,
      amenityCount: null,
      diningDistanceMeters: null,
    });

    expect(score.valueScore).not.toBeNull();
    expect(score.comfortScore).toBeNull();
    expect(score.privacyScore).toBeNull();
    expect(score.socialScore).toBeNull();
    expect(score.convenienceScore).toBeNull();
    expect(score.freshmanFitScore).toBeNull();
    expect(score.amenityScore).toBeNull();
    expect(score.overallScore).toBeNull();
    expect(score.scoreable).toBe(false);
  });

  it("distinguishes zero from unknown", () => {
    const withZeroAmenities = computeDormScore({
      yearlyCost: 12000,
      collegeAvgCost: 15000,
      hasAC: false,
      bathroomStyle: "COMMUNAL",
      freshmanEligible: false,
      amenityCount: 0,
      socialVibe: 0,
      diningDistanceMeters: 2000,
    });

    expect(withZeroAmenities.amenityScore).toBe(0);
    expect(withZeroAmenities.socialScore).toBe(0);
    expect(withZeroAmenities.freshmanFitScore).toBe(45);
    expect(withZeroAmenities.comfortScore).toBeLessThan(50);

    const unknown = computeDormScore({});
    expect(unknown.amenityScore).toBeNull();
    expect(unknown.socialScore).toBeNull();
    expect(unknown.freshmanFitScore).toBeNull();
    expect(unknown.comfortScore).toBeNull();
  });

  it("does not let data confidence boost housing quality overall", () => {
    const sparseWithHighConfidence = computeDormScore({
      confidenceScore: 1,
      dataCompletenessScore: 1,
      yearlyCost: 15000,
      collegeAvgCost: 15000,
    });

    const sparseWithLowConfidence = computeDormScore({
      confidenceScore: 0.1,
      dataCompletenessScore: 0.1,
      yearlyCost: 15000,
      collegeAvgCost: 15000,
    });

    expect(sparseWithHighConfidence.overallScore).toBeNull();
    expect(sparseWithLowConfidence.overallScore).toBeNull();
    expect(sparseWithHighConfidence.dataConfidenceScore).toBe(100);
    expect(sparseWithLowConfidence.dataConfidenceScore).toBe(10);
    expect(sparseWithHighConfidence.valueScore).toBe(sparseWithLowConfidence.valueScore);
  });

  it("suppresses overall score for sparse records below MIN_QUALITY_EVIDENCE", () => {
    const score = computeDormScore({
      yearlyCost: 12000,
      collegeAvgCost: 15000,
      hasAC: true,
      // only 2 quality dimensions: value + comfort
    });

    expect(MIN_QUALITY_EVIDENCE).toBe(3);
    expect(score.completeness).toBeLessThan(1);
    expect(score.scoreable).toBe(false);
    expect(score.overallScore).toBeNull();
  });

  it("scores well-populated records", () => {
    const score = computeDormScore({
      yearlyCost: 12000,
      collegeAvgCost: 15000,
      hasAC: true,
      bathroomStyle: "SUITE",
      privacyRating: 7,
      socialVibe: 8,
      quietVibe: 5,
      freshmanEligible: true,
      amenityCount: 6,
      diningDistanceMeters: 250,
      confidenceScore: 0.9,
    });

    expect(score.scoreable).toBe(true);
    expect(score.overallScore).not.toBeNull();
    expect(score.overallScore!).toBeGreaterThan(0);
    expect(score.overallScore!).toBeLessThanOrEqual(100);
    expect(score.valueScore).not.toBeNull();
    expect(score.comfortScore).not.toBeNull();
    expect(score.privacyScore).not.toBeNull();
    expect(score.socialScore).not.toBeNull();
    expect(score.convenienceScore).not.toBeNull();
    expect(score.freshmanFitScore).not.toBeNull();
    expect(score.amenityScore).not.toBeNull();
    expect(score.dataConfidenceScore).toBe(90);
    expect(score.completeness).toBe(1);
  });
});
