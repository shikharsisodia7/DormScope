import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreBreakdown } from "@/components/dorms/score-breakdown";
import { DormActions } from "@/components/dorms/dorm-actions";
import { fetchApi } from "@/lib/utils";
import { getDormBadges } from "@dormscope/shared";

interface DormPageResponse {
  dorm: {
    id: string;
    name: string;
    slug: string;
    bathroomStyle: string;
    dormType: string;
    hasAC?: boolean;
    yearlyCost?: number;
    semesterCost?: number;
    freshmanEligible: boolean;
    honorsHousing: boolean;
    officialHousingUrl?: string;
    imageUrl?: string;
    confidenceScore: number;
    dataCompletenessScore: number;
    lastUpdatedAt: string;
    socialVibe?: number;
    quietVibe?: number;
    college: { name: string; slug: string; state: string; city: string };
    dormScore?: {
      overallScore: number;
      valueScore: number;
      comfortScore: number;
      privacyScore: number;
      socialScore: number;
      convenienceScore: number;
      freshmanFitScore: number;
      amenityScore: number;
      dataConfidenceScore: number;
      breakdown?: Record<string, number>;
    };
    dormAmenities: { amenity: { name: string } }[];
    roomTypes: { name: string; capacity?: number; yearlyCost?: number }[];
    housingCosts: { label: string; amount: number; period: string }[];
    reviewSummaries: { ruleBasedSummary?: string; pros: string[]; cons: string[]; vibeLabels: string[] }[];
    sources: { url: string; title?: string; sourceType: string }[];
  };
  collegeAvgCost: number;
}

export default async function DormProfilePage({
  params,
}: {
  params: { slug: string; dormSlug: string };
}) {
  let data: DormPageResponse;
  try {
    data = await fetchApi(`/api/dorms/${params.slug}/${params.dormSlug}`);
  } catch {
    notFound();
  }

  const { dorm, collegeAvgCost } = data;
  const review = dorm.reviewSummaries[0];
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
    confidenceScore: dorm.confidenceScore,
  });

  return (
    <div className="container py-10 space-y-8">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <Link href={`/colleges/${params.slug}`} className="text-sm text-primary hover:underline">
            ← {dorm.college.name}
          </Link>
          <h1 className="text-3xl font-bold mt-2">{dorm.name}</h1>
          <p className="text-muted-foreground">
            {dorm.college.city}, {dorm.college.state}
          </p>
        </div>
        {dorm.dormScore && (
          <div className="text-center border rounded-xl px-8 py-4">
            <p className="text-sm text-muted-foreground">DormScope Score</p>
            <p className="text-5xl font-bold text-primary">{dorm.dormScore.overallScore}</p>
          </div>
        )}
      </div>

      <DormActions dormId={dorm.id} dormName={dorm.name} />

      <div className="flex flex-wrap gap-2">
        {badges.map((b) => (
          <Badge key={b.label} variant={b.variant}>{b.label}</Badge>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>What this means</CardTitle></CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none text-sm">
              <p>{review?.ruleBasedSummary ?? "Review official housing pages for the latest details."}</p>
            </CardContent>
          </Card>

          {dorm.dormScore && <ScoreBreakdown score={dorm.dormScore} />}

          <Card>
            <CardHeader><CardTitle>Room types & costs</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {dorm.roomTypes.map((r) => (
                  <li key={r.name}>
                    {r.name} {r.capacity ? `(${r.capacity}-person)` : ""}{" "}
                    {r.yearlyCost ? `— $${r.yearlyCost.toLocaleString()}/yr` : ""}
                  </li>
                ))}
                {dorm.housingCosts.map((c) => (
                  <li key={c.label}>{c.label}: ${c.amount.toLocaleString()} ({c.period})</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Quick facts</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>Yearly: {dorm.yearlyCost ? `$${dorm.yearlyCost.toLocaleString()}` : "Unknown"}</p>
              <p>Bathroom: {dorm.bathroomStyle}</p>
              <p>AC: {dorm.hasAC == null ? "Unknown" : dorm.hasAC ? "Yes" : "No"}</p>
              <p>Confidence: {Math.round(dorm.confidenceScore * 100)}%</p>
              <p>Updated: {new Date(dorm.lastUpdatedAt).toLocaleDateString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Amenities</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-1">
              {dorm.dormAmenities.map((a) => (
                <Badge key={a.amenity.name} variant="outline">{a.amenity.name}</Badge>
              ))}
            </CardContent>
          </Card>
          {review && (
            <Card>
              <CardHeader><CardTitle>Pros & cons</CardTitle></CardHeader>
              <CardContent className="text-sm">
                <p className="font-medium text-emerald-600">+ {review.pros.join(", ") || "—"}</p>
                <p className="font-medium text-amber-600 mt-2">− {review.cons.join(", ") || "—"}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
