import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getDormBadges } from "@dormscope/shared";
import { moneyOrUnknown } from "@/lib/utils";

export interface DormCardData {
  id: string;
  name: string;
  slug: string;
  yearlyCost?: number | null;
  bathroomStyle?: string;
  hasAC?: boolean | null;
  freshmanEligible?: boolean | null;
  upperclassEligible?: boolean | null;
  dormType?: string;
  honorsHousing?: boolean | null;
  themedHousing?: boolean | null;
  genderInclusive?: boolean | null;
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
    <article className="flex h-full flex-col rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-lg leading-snug">
            <Link
              href={`/colleges/${dorm.college.slug}/dorms/${dorm.slug}`}
              className="hover:text-primary"
            >
              {dorm.name}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {dorm.college.name} · {dorm.college.state}
          </p>
        </div>
        {dorm.dormScore != null && (
          <span className="font-display text-2xl tabular-nums text-primary">
            {dorm.dormScore.overallScore}
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {badges.slice(0, 5).map((b) => (
          <Badge key={b.label} variant={b.variant}>
            {b.label}
          </Badge>
        ))}
      </div>
      <div className="mt-auto grid grid-cols-2 gap-1 pt-4 text-sm text-muted-foreground">
        <span>Cost: {moneyOrUnknown(dorm.yearlyCost)}</span>
        <span>Bath: {dorm.bathroomStyle?.replace(/_/g, " ") ?? "Unknown"}</span>
      </div>
    </article>
  );
}
