import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDormBadges } from "@dormscope/shared";

export interface DormCardData {
  id: string;
  name: string;
  slug: string;
  yearlyCost?: number | null;
  bathroomStyle?: string;
  hasAC?: boolean | null;
  freshmanEligible?: boolean;
  dormType?: string;
  honorsHousing?: boolean;
  socialVibe?: number | null;
  quietVibe?: number | null;
  confidenceScore?: number;
  isVerified?: boolean;
  diningDistanceMeters?: number | null;
  college: { name: string; slug: string; state: string };
  dormScore?: { overallScore: number } | null;
}

export function DormCard({ dorm, collegeAvgCost }: { dorm: DormCardData; collegeAvgCost?: number }) {
  const badges = getDormBadges({
    hasAC: dorm.hasAC,
    freshmanEligible: dorm.freshmanEligible,
    dormType: dorm.dormType,
    honorsHousing: dorm.honorsHousing,
    bathroomStyle: dorm.bathroomStyle,
    socialVibe: dorm.socialVibe,
    quietVibe: dorm.quietVibe,
    yearlyCost: dorm.yearlyCost,
    collegeAvgCost,
    diningDistanceMeters: dorm.diningDistanceMeters,
    confidenceScore: dorm.confidenceScore,
    isVerified: dorm.isVerified,
  });

  return (
    <Card className="hover:shadow-md transition-shadow h-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-lg">
            <Link
              href={`/colleges/${dorm.college.slug}/dorms/${dorm.slug}`}
              className="hover:text-primary"
            >
              {dorm.name}
            </Link>
          </CardTitle>
          {dorm.dormScore && (
            <span className="text-2xl font-bold text-primary">{dorm.dormScore.overallScore}</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {dorm.college.name} · {dorm.college.state}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {badges.slice(0, 5).map((b) => (
            <Badge key={b.label} variant={b.variant}>
              {b.label}
            </Badge>
          ))}
        </div>
        <div className="text-sm grid grid-cols-2 gap-1 text-muted-foreground">
          <span>Cost: {dorm.yearlyCost ? `$${dorm.yearlyCost.toLocaleString()}/yr` : "Unknown"}</span>
          <span>Bath: {dorm.bathroomStyle?.replace("_", " ") ?? "Unknown"}</span>
        </div>
      </CardContent>
    </Card>
  );
}
