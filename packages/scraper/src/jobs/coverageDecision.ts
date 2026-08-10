import { HousingCoverageStatus } from "@dormscope/database";

export interface ScrapeCounters {
  acceptedCandidates: number;
  newEntitiesCreated: number;
  existingEntitiesUpdated: number;
  uniqueEntitiesSeenThisRun: number;
  duplicatesSuppressed: number;
  rejectedCandidates: number;
  pagesVisited: number;
  directoryPagesVisited: number;
  detailPagesVisited: number;
  unresolvedHousingLinks: number;
  officialDirectorySourcesFound: number;
  unchangedPagesSkipped: number;
  blocked: boolean;
  lastHttpStatus?: number;
}

export interface CoverageDecisionInput extends ScrapeCounters {
  hasResidentialHousing?: boolean | null;
  /** Explicit published inventory count from official page, if known */
  publishedInventoryCount?: number | null;
  /** High-confidence housing-directory links left in frontier */
  unresolvedHighPriorityDirectoryLinks?: number;
  /** Crawl hit max pages before frontier emptied */
  hitPageBudget?: boolean;
  /** Crawl found an official housing site URL */
  housingSiteFound?: boolean;
  /** At least one directory-role page successfully parsed */
  directoryParsed?: boolean;
}

/**
 * Exhaustive completion requires directory evidence — never a raw accepted count.
 * Rediscovered/updated entities do not inflate "new inventory."
 */
export function decideHousingCoverage(input: CoverageDecisionInput): HousingCoverageStatus {
  if (input.hasResidentialHousing === false) {
    return HousingCoverageStatus.NO_HOUSING;
  }
  if (input.blocked) {
    return HousingCoverageStatus.BLOCKED;
  }

  const unique = input.uniqueEntitiesSeenThisRun;
  const createdOrUpdated = input.newEntitiesCreated + input.existingEntitiesUpdated;
  const unresolved =
    (input.unresolvedHighPriorityDirectoryLinks ?? input.unresolvedHousingLinks) > 0;
  const hitBudget = input.hitPageBudget === true;

  if (unique === 0 && createdOrUpdated === 0) {
    if (input.housingSiteFound || input.officialDirectorySourcesFound > 0) {
      return HousingCoverageStatus.SITE_FOUND;
    }
    return HousingCoverageStatus.RETRYABLE;
  }

  // Directory found but not successfully parsed into inventory
  if (unique === 0 && input.officialDirectorySourcesFound > 0 && !input.directoryParsed) {
    return HousingCoverageStatus.DIRECTORY_PENDING;
  }

  // Never COMPLETE from count alone (e.g. >= 8 accepted)
  const published = input.publishedInventoryCount;
  const reconciles =
    published != null &&
    published > 0 &&
    Math.abs(unique - published) / published <= 0.2;

  const exhausted =
    input.directoryParsed === true &&
    input.officialDirectorySourcesFound >= 1 &&
    !unresolved &&
    !hitBudget &&
    !input.blocked;

  if (exhausted && unique >= 1 && (reconciles || published == null)) {
    // Without published count, require stronger evidence: multiple directory pages
    // or enough unique entities with zero unresolved links and no page budget hit.
    if (published != null || input.directoryPagesVisited >= 1) {
      return HousingCoverageStatus.COMPLETE;
    }
  }

  return HousingCoverageStatus.PARTIAL;
}
