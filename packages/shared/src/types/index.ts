/** Preference importance: 0=irrelevant, 1=somewhat, 2=important, 3=very, 4=must */
export type PreferenceImportanceLevel = 0 | 1 | 2 | 3 | 4;

export const PreferenceImportance = {
  IRRELEVANT: 0,
  SOMEWHAT: 1,
  IMPORTANT: 2,
  VERY: 3,
  MUST: 4,
} as const satisfies Record<string, PreferenceImportanceLevel>;

export type PreferenceControlType = "importance" | "spectrum" | "toggle" | "requirement";
export type PreferenceScoringMode =
  | "quality"
  | "spectrum"
  | "boolean_match"
  | "proximity"
  | "cost"
  | "categorical";
export type PreferenceCategory =
  | "atmosphere"
  | "room"
  | "bathroom"
  | "amenities"
  | "community"
  | "location"
  | "cost"
  | "building"
  | "eligibility"
  | "overall";

export interface PreferenceExplanationTemplates {
  positive: string;
  negative: string;
  unknown: string;
}

export interface PreferenceDimensionDef {
  id: string;
  label: string;
  description: string;
  category: PreferenceCategory;
  controlType: PreferenceControlType;
  scoringMode: PreferenceScoringMode;
  supportsHardConstraint: boolean;
  /** Dorm attribute keys used as evidence for this dimension */
  evidenceFields: string[];
  defaultImportance: PreferenceImportanceLevel;
  explanations: PreferenceExplanationTemplates;
  /** For spectrum controls: low/high pole labels */
  spectrumPoles?: { low: string; high: string };
  /** For categorical scoring: preferred category values that score highly */
  preferredCategories?: string[];
}

/** Hard constraints filter halls out before soft scoring. Missing evidence does not fail. */
export interface HardConstraints {
  requireFreshmanEligible?: boolean;
  requireUpperclassEligible?: boolean;
  maxBudget?: number | null;
  requireSingle?: boolean;
  requirePrivateBath?: boolean;
  requirePrivateOrSuiteBath?: boolean;
  requireGenderInclusive?: boolean;
  requireAC?: boolean;
  requireAccessibility?: boolean;
  requireSubstanceFree?: boolean;
  requireElevator?: boolean;
  /** Extra free-form constraint ids from the preference registry */
  [key: string]: boolean | number | null | undefined;
}

export interface PreferenceProfile {
  /** Soft preference weights keyed by preference dimension id (0–4) */
  weights: Record<string, PreferenceImportanceLevel | number>;
  hardConstraints: HardConstraints;
  /** Spectrum position 0–1 (or 0–10) keyed by dimension id when controlType is spectrum */
  spectrumValues?: Record<string, number>;
  /** Soft toggle desires keyed by dimension id */
  toggles?: Record<string, boolean>;
}

export type ConfidenceLabel = "high" | "medium" | "low" | "very_low";

export interface MatchExplanation {
  positives: string[];
  tradeoffs: string[];
  unknowns: string[];
}

export interface DimensionScoreResult {
  score: number;
  weight: number;
  hasEvidence: boolean;
  explanation?: string;
}

export interface RankedMatchBase {
  matchScore: number;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  reasons: MatchExplanation;
  dimensionScores: Record<string, DimensionScoreResult>;
  excluded?: false;
  algorithmVersion: string;
}

export interface DormSearchFilters {
  q?: string;
  collegeId?: string;
  state?: string;
  city?: string;
  dormType?: string;
  bathroomStyle?: string;
  hasAC?: boolean;
  freshmanOnly?: boolean;
  honorsHousing?: boolean;
  minCost?: number;
  maxCost?: number;
  minScore?: number;
  amenities?: string[];
  socialMin?: number;
  quietMin?: number;
}

export interface QuizAnswers {
  isFreshman: boolean;
  prefersSocial: boolean;
  prefersQuiet: boolean;
  priorityPrice: number;
  priorityComfort: number;
  priorityPrivacy: number;
  priorityLocation: number;
  wantsAC: boolean;
  bathroomPreference: "communal" | "suite" | "private";
  nearDining: boolean;
  apartmentStyle: boolean;
  honorsThemed: boolean;
  studyLounges: boolean;
  cheapestVsBestFit: "cheapest" | "best_fit";
}

export interface DormBadge {
  label: string;
  variant: "default" | "secondary" | "success" | "warning" | "destructive" | "outline";
}

export interface ScoreBreakdown {
  overallScore: number | null;
  scoreable?: boolean;
  valueScore: number | null;
  comfortScore: number | null;
  privacyScore: number | null;
  socialScore: number | null;
  convenienceScore: number | null;
  freshmanFitScore: number | null;
  amenityScore: number | null;
  dataConfidenceScore: number | null;
  /** Fraction of score components that had real evidence (0–1) */
  completeness?: number;
}

export interface NationalStats {
  totalColleges: number;
  totalDorms: number;
  totalSources: number;
  avgConfidence: number;
  statesCovered: number;
}
