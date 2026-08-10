import { describe, expect, it } from "vitest";
import { HousingCoverageStatus } from "@dormscope/database";
import { decideHousingCoverage } from "./coverageDecision";

const base = {
  acceptedCandidates: 0,
  newEntitiesCreated: 0,
  existingEntitiesUpdated: 0,
  uniqueEntitiesSeenThisRun: 0,
  duplicatesSuppressed: 0,
  rejectedCandidates: 0,
  pagesVisited: 0,
  directoryPagesVisited: 0,
  detailPagesVisited: 0,
  unresolvedHousingLinks: 0,
  officialDirectorySourcesFound: 0,
  unchangedPagesSkipped: 0,
  blocked: false,
};

describe("decideHousingCoverage", () => {
  it("does not mark COMPLETE merely because 8 candidates were accepted", () => {
    const status = decideHousingCoverage({
      ...base,
      acceptedCandidates: 8,
      uniqueEntitiesSeenThisRun: 8,
      newEntitiesCreated: 8,
      pagesVisited: 2,
      hitPageBudget: true,
      unresolvedHousingLinks: 3,
      officialDirectorySourcesFound: 1,
      directoryParsed: true,
    });
    expect(status).toBe(HousingCoverageStatus.PARTIAL);
  });

  it("counts unique inventory once even when the same entity is rediscovered", () => {
    const status = decideHousingCoverage({
      ...base,
      acceptedCandidates: 20,
      uniqueEntitiesSeenThisRun: 4,
      newEntitiesCreated: 1,
      existingEntitiesUpdated: 19,
      pagesVisited: 5,
      officialDirectorySourcesFound: 1,
      directoryParsed: true,
      hitPageBudget: true,
      unresolvedHousingLinks: 2,
    });
    expect(status).toBe(HousingCoverageStatus.PARTIAL);
  });

  it("keeps PARTIAL when directory pagination remains unresolved", () => {
    const status = decideHousingCoverage({
      ...base,
      uniqueEntitiesSeenThisRun: 10,
      newEntitiesCreated: 10,
      officialDirectorySourcesFound: 1,
      directoryParsed: true,
      directoryPagesVisited: 1,
      unresolvedHighPriorityDirectoryLinks: 4,
    });
    expect(status).toBe(HousingCoverageStatus.PARTIAL);
  });

  it("can become COMPLETE when directory is exhausted", () => {
    const status = decideHousingCoverage({
      ...base,
      uniqueEntitiesSeenThisRun: 10,
      newEntitiesCreated: 10,
      officialDirectorySourcesFound: 1,
      directoryParsed: true,
      directoryPagesVisited: 2,
      unresolvedHousingLinks: 0,
      hitPageBudget: false,
      publishedInventoryCount: 10,
    });
    expect(status).toBe(HousingCoverageStatus.COMPLETE);
  });

  it("blocked traversal cannot become COMPLETE", () => {
    const status = decideHousingCoverage({
      ...base,
      uniqueEntitiesSeenThisRun: 12,
      newEntitiesCreated: 12,
      officialDirectorySourcesFound: 1,
      directoryParsed: true,
      blocked: true,
    });
    expect(status).toBe(HousingCoverageStatus.BLOCKED);
  });

  it("housing site with zero entities is SITE_FOUND not FAILED", () => {
    const status = decideHousingCoverage({
      ...base,
      housingSiteFound: true,
      officialDirectorySourcesFound: 1,
    });
    expect(status).toBe(HousingCoverageStatus.SITE_FOUND);
  });
});
