import type { DormBadge } from "../types";

export interface DormBadgeInput {
  hasAC?: boolean | null;
  freshmanEligible?: boolean;
  dormType?: string;
  honorsHousing?: boolean;
  bathroomStyle?: string;
  socialVibe?: number | null;
  quietVibe?: number | null;
  yearlyCost?: number | null;
  collegeAvgCost?: number;
  diningDistanceMeters?: number | null;
  confidenceScore?: number;
  isVerified?: boolean;
}

export function getDormBadges(d: DormBadgeInput): DormBadge[] {
  const badges: DormBadge[] = [];

  if (d.hasAC) badges.push({ label: "Has AC", variant: "success" });
  if (d.freshmanEligible) badges.push({ label: "Freshman Friendly", variant: "default" });
  if (d.dormType === "SUITE" || d.bathroomStyle === "SUITE") badges.push({ label: "Suite Style", variant: "secondary" });
  if (d.dormType === "APARTMENT") badges.push({ label: "Apartment Style", variant: "secondary" });
  if (d.honorsHousing) badges.push({ label: "Honors Housing", variant: "default" });
  if ((d.socialVibe ?? 0) >= 7) badges.push({ label: "Social Dorm", variant: "default" });
  if ((d.quietVibe ?? 0) >= 7) badges.push({ label: "Quiet Dorm", variant: "outline" });
  if (d.yearlyCost && d.collegeAvgCost && d.yearlyCost < d.collegeAvgCost * 0.95) {
    badges.push({ label: "Best Value", variant: "success" });
  }
  if ((d.diningDistanceMeters ?? 9999) < 400) badges.push({ label: "Close to Dining", variant: "outline" });
  if ((d.confidenceScore ?? 0) >= 0.85) badges.push({ label: "High Confidence Data", variant: "success" });
  else if ((d.confidenceScore ?? 0) < 0.6) badges.push({ label: "Needs Verification", variant: "warning" });
  if (!d.isVerified && (d.confidenceScore ?? 1) < 0.7) badges.push({ label: "Needs Verification", variant: "warning" });

  return badges;
}
