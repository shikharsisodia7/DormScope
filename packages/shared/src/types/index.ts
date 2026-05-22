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
  overallScore: number;
  valueScore: number;
  comfortScore: number;
  privacyScore: number;
  socialScore: number;
  convenienceScore: number;
  freshmanFitScore: number;
  amenityScore: number;
  dataConfidenceScore: number;
}

export interface NationalStats {
  totalColleges: number;
  totalDorms: number;
  totalSources: number;
  avgConfidence: number;
  statesCovered: number;
}
