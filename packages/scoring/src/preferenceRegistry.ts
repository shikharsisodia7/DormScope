/**
 * Thin re-export of the shared preference registry (single source of truth).
 */
export {
  PREFERENCE_DIMENSIONS,
  getPreferenceDimension,
  listPreferenceDimensions,
  listPreferencesByCategory,
  defaultPreferenceWeights,
  emptyHardConstraints,
  type PreferenceDimensionId,
} from "@dormscope/shared";

export type {
  PreferenceDimensionDef,
  PreferenceProfile,
  PreferenceImportanceLevel,
  HardConstraints,
  MatchExplanation,
  DimensionScoreResult,
  ConfidenceLabel,
  PreferenceControlType,
  PreferenceScoringMode,
} from "@dormscope/shared";

export { PreferenceImportance } from "@dormscope/shared";
