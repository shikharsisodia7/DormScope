import type { RankableDorm } from "@dormscope/scoring";

type DormRow = {
  id: string;
  name: string;
  slug?: string;
  yearlyCost?: number | null;
  semesterCost?: number | null;
  hasAC?: boolean | null;
  bathroomStyle?: string | null;
  dormType?: string | null;
  freshmanEligible?: boolean | null;
  upperclassEligible?: boolean | null;
  honorsHousing?: boolean | null;
  themedHousing?: boolean | null;
  genderInclusive?: boolean | null;
  substanceFree?: boolean | null;
  elevatorAccess?: boolean | null;
  laundryAccess?: boolean | null;
  kitchenAccess?: boolean | null;
  studyLounges?: boolean | null;
  socialVibe?: number | null;
  quietVibe?: number | null;
  cleanlinessRating?: number | null;
  privacyRating?: number | null;
  diningDistanceMeters?: number | null;
  gymDistanceMeters?: number | null;
  classroomDistanceMeters?: number | null;
  campusZone?: string | null;
  buildingAge?: number | null;
  renovationYear?: number | null;
  approximateResidents?: number | null;
  confidenceScore?: number | null;
  dataCompletenessScore?: number | null;
  lastUpdatedAt?: Date | null;
  wheelchairAccessible?: boolean | null;
  livingLearning?: boolean | null;
  college?: { name?: string } | null;
  dormScore?: RankableDorm["dormScore"];
  roomTypes?: Array<{ normalized?: string; name?: string; capacity?: number | null }> | null;
  dormAmenities?: Array<{ amenity?: { normalized?: string; name?: string } | null }> | null;
};

export function toRankableDorm(d: DormRow, collegeAvgCost?: number | null): RankableDorm {
  const amenityFlags =
    d.dormAmenities
      ?.map((a) => a.amenity?.normalized ?? a.amenity?.name)
      .filter((x): x is string => Boolean(x)) ?? [];

  return {
    id: d.id,
    name: d.name,
    slug: d.slug,
    collegeName: d.college?.name,
    yearlyCost: d.yearlyCost,
    semesterCost: d.semesterCost,
    collegeAvgCost: collegeAvgCost ?? null,
    hasAC: d.hasAC,
    bathroomStyle: d.bathroomStyle,
    dormType: d.dormType,
    freshmanEligible: d.freshmanEligible,
    upperclassEligible: d.upperclassEligible,
    honorsHousing: d.honorsHousing,
    themedHousing: d.themedHousing,
    genderInclusive: d.genderInclusive,
    substanceFree: d.substanceFree,
    accessible: d.wheelchairAccessible,
    elevatorAccess: d.elevatorAccess,
    laundryAccess: d.laundryAccess,
    kitchenAccess: d.kitchenAccess,
    studyLounges: d.studyLounges,
    isLivingLearning: d.livingLearning,
    socialVibe: d.socialVibe,
    quietVibe: d.quietVibe,
    cleanlinessRating: d.cleanlinessRating,
    privacyRating: d.privacyRating,
    diningDistanceMeters: d.diningDistanceMeters,
    gymDistanceMeters: d.gymDistanceMeters,
    classroomDistanceMeters: d.classroomDistanceMeters,
    campusZone: d.campusZone,
    buildingAge: d.buildingAge,
    renovationYear: d.renovationYear,
    residentCount: d.approximateResidents,
    confidenceScore: d.confidenceScore,
    dataCompletenessScore: d.dataCompletenessScore,
    lastUpdatedAt: d.lastUpdatedAt,
    dormScore: d.dormScore,
    roomTypes: d.roomTypes,
    amenityCount: amenityFlags.length || null,
    amenityFlags,
  };
}
