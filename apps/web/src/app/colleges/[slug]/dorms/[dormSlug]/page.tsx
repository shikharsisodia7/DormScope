import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreBreakdown } from "@/components/dorms/score-breakdown";
import { DormActions } from "@/components/dorms/dorm-actions";
import { ReviewForm } from "@/components/dorms/review-form";
import { factLabel, moneyOrUnknown } from "@/lib/utils";
import { getDormBySlugs } from "@/lib/data";
import { getDormBadges } from "@dormscope/shared";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string; dormSlug: string };
}): Promise<Metadata> {
  const data = await getDormBySlugs(params.slug, params.dormSlug);
  if (!data) return { title: "Dorm not found" };
  const { dorm } = data;
  return {
    title: `${dorm.name} · ${dorm.college.name}`,
    description: `Facts, sources, and reviews for ${dorm.name} at ${dorm.college.name}. Missing fields show as Unknown.`,
  };
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export default async function DormProfilePage({
  params,
}: {
  params: { slug: string; dormSlug: string };
}) {
  const data = await getDormBySlugs(params.slug, params.dormSlug);
  if (!data) notFound();

  const { dorm, collegeAvgCost } = data;
  const review = dorm.reviewSummaries[0];
  const approvedReviews = dorm.reviews ?? [];
  const badges = getDormBadges({
    hasAC: dorm.hasAC,
    freshmanEligible: dorm.freshmanEligible ?? undefined,
    dormType: dorm.dormType ?? undefined,
    honorsHousing: dorm.honorsHousing ?? undefined,
    bathroomStyle: dorm.bathroomStyle ?? undefined,
    socialVibe: dorm.socialVibe,
    quietVibe: dorm.quietVibe,
    yearlyCost: dorm.yearlyCost,
    collegeAvgCost,
    confidenceScore: dorm.confidenceScore,
  });

  return (
    <div className="site-container space-y-10 py-10 md:py-14">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <Link
            href={`/colleges/${params.slug}`}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            ← {dorm.college.name}
          </Link>
          <h1 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">{dorm.name}</h1>
          <p className="text-muted-foreground">
            {dorm.college.city}, {dorm.college.state}
          </p>
        </div>
        {dorm.dormScore && (
          <div className="text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">DormScope Score</p>
            <p className="font-display text-5xl text-primary tabular-nums">{dorm.dormScore.overallScore}</p>
          </div>
        )}
      </header>

      <DormActions dormId={dorm.id} dormName={dorm.name} />

      {badges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {badges.map((b) => (
            <Badge key={b.label} variant={b.variant}>
              {b.label}
            </Badge>
          ))}
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {(review?.ruleBasedSummary || dorm.officialHousingUrl) && (
            <section>
              <h2 className="font-display text-2xl">Overview</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {review?.ruleBasedSummary ??
                  "See official housing pages and sources below for the latest details."}
              </p>
              {dorm.officialHousingUrl && (
                <a
                  href={dorm.officialHousingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm text-primary underline-offset-4 hover:underline"
                >
                  Official hall page
                </a>
              )}
            </section>
          )}

          {dorm.dormScore && <ScoreBreakdown score={dorm.dormScore} />}

          <section>
            <h2 className="font-display text-2xl">Room types & costs</h2>
            {dorm.roomTypes.length === 0 && dorm.housingCosts.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Unknown — no room or cost rows on file.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {dorm.roomTypes.map((r) => (
                  <li key={r.name} className="flex justify-between gap-4 border-b border-border/50 py-2">
                    <span>
                      {r.name}
                      {r.capacity != null ? ` (${r.capacity}-person)` : ""}
                    </span>
                    <span className="text-muted-foreground">{moneyOrUnknown(r.yearlyCost)}</span>
                  </li>
                ))}
                {dorm.housingCosts.map((c) => (
                  <li key={c.label} className="flex justify-between gap-4 border-b border-border/50 py-2">
                    <span>{c.label}</span>
                    <span className="text-muted-foreground">
                      ${c.amount.toLocaleString()} ({c.period})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="font-display text-2xl">Sources</h2>
            {dorm.sources.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No approved sources linked yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {dorm.sources.map((s) => (
                  <li key={s.url}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {s.title || s.url}
                    </a>
                    <span className="ml-2 text-xs text-muted-foreground">{s.sourceType}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-6">
            <div>
              <h2 className="font-display text-2xl">Reviews</h2>
              <p className="mt-1 text-sm text-muted-foreground">Approved student reviews only.</p>
            </div>
            {approvedReviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">No approved reviews yet. Be the first to share.</p>
            ) : (
              <ul className="space-y-4">
                {approvedReviews.map((r) => (
                  <li key={r.id} className="rounded-lg border border-border bg-card p-4 text-sm">
                    <p className="font-medium">
                      {r.overallRating}/5
                      {r.schoolYear ? (
                        <span className="ml-2 font-normal text-muted-foreground">{r.schoolYear}</span>
                      ) : null}
                    </p>
                    {r.pros && <p className="mt-2 text-primary">+ {r.pros}</p>}
                    {r.cons && <p className="mt-1 text-score">− {r.cons}</p>}
                    {r.advice && <p className="mt-2 text-muted-foreground">Advice: {r.advice}</p>}
                    {r.body && <p className="mt-2 text-muted-foreground">{r.body}</p>}
                  </li>
                ))}
              </ul>
            )}
            <ReviewForm dormId={dorm.id} />
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-display text-lg">Quick facts</h2>
            <dl className="mt-3">
              <Fact label="Yearly cost" value={moneyOrUnknown(dorm.yearlyCost)} />
              <Fact label="Semester cost" value={moneyOrUnknown(dorm.semesterCost, "/sem")} />
              <Fact
                label="Bathroom"
                value={dorm.bathroomStyle?.replace(/_/g, " ") ?? "Unknown"}
              />
              <Fact label="AC" value={factLabel(dorm.hasAC)} />
              <Fact label="Freshman eligible" value={factLabel(dorm.freshmanEligible)} />
              <Fact label="Elevator" value={factLabel(dorm.elevatorAccess)} />
              <Fact label="Laundry" value={factLabel(dorm.laundryAccess)} />
              <Fact label="Kitchen" value={factLabel(dorm.kitchenAccess)} />
              <Fact label="Study lounges" value={factLabel(dorm.studyLounges)} />
              <Fact label="Confidence" value={`${Math.round(dorm.confidenceScore * 100)}%`} />
              <Fact label="Updated" value={new Date(dorm.lastUpdatedAt).toLocaleDateString()} />
            </dl>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-display text-lg">Amenities</h2>
            {dorm.dormAmenities.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Unknown</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-1">
                {dorm.dormAmenities.map((a) => (
                  <Badge key={a.amenity.name} variant="outline">
                    {a.amenity.name}
                  </Badge>
                ))}
              </div>
            )}
          </section>

          {review && (review.pros.length > 0 || review.cons.length > 0) && (
            <section className="rounded-lg border border-border bg-card p-5 text-sm">
              <h2 className="font-display text-lg">Summary signals</h2>
              <p className="mt-3 text-primary">+ {review.pros.join(", ") || "—"}</p>
              <p className="mt-2 text-score">− {review.cons.join(", ") || "—"}</p>
            </section>
          )}

          <Link href={`/match?college=${params.slug}`}>
            <Button className="w-full">Find My Best Dorm here</Button>
          </Link>
        </aside>
      </div>
    </div>
  );
}
