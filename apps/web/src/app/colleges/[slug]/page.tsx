import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DormCard, type DormCardData } from "@/components/dorms/dorm-card";
import { Button } from "@/components/ui/button";
import { CollegeCharts } from "@/components/colleges/college-charts";
import { fetchApi } from "@/lib/utils";

interface CollegePageData {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  websiteUrl?: string;
  housingUrl?: string;
  dorms: DormCardData[];
  highlights: {
    avgCost: number;
    hasCostEvidence?: boolean;
    cheapest?: { name: string; yearlyCost?: number } | null;
    expensive?: { name: string; yearlyCost?: number } | null;
    bestFreshman?: { name: string } | null;
    bestValue?: { name: string } | null;
    mostSocial?: { name: string } | null;
    quietest?: { name: string } | null;
  };
}

async function loadCollege(slug: string): Promise<CollegePageData | null> {
  try {
    return await fetchApi<CollegePageData>(`/api/colleges/${slug}`, { cache: "no-store" });
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const data = await loadCollege(params.slug);
  if (!data) return { title: "College not found" };
  return {
    title: `${data.name} dorms`,
    description: `Explore residence halls at ${data.name} in ${data.city}, ${data.state}. Compare amenities, costs, and find your best dorm fit.`,
  };
}

export default async function CollegePage({ params }: { params: { slug: string } }) {
  const data = await loadCollege(params.slug);
  if (!data) notFound();

  const { highlights, dorms } = data;
  const rankings: { label: string; name: string }[] = [];
  if (highlights.cheapest?.name) rankings.push({ label: "Most affordable (listed)", name: highlights.cheapest.name });
  if (highlights.bestFreshman?.name) rankings.push({ label: "Strong freshman fit", name: highlights.bestFreshman.name });
  if (highlights.mostSocial?.name) rankings.push({ label: "Most social (evidence)", name: highlights.mostSocial.name });
  if (highlights.quietest?.name) rankings.push({ label: "Quietest (evidence)", name: highlights.quietest.name });
  if (highlights.bestValue?.name) rankings.push({ label: "Best value score", name: highlights.bestValue.name });

  return (
    <div className="site-container space-y-12 py-10 md:py-14">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {data.city}, {data.state}
          </p>
          <h1 className="mt-1 font-display text-3xl tracking-tight md:text-4xl">{data.name}</h1>
          <p className="mt-2 text-muted-foreground">
            {dorms.length === 0
              ? "No residence halls indexed yet."
              : `${dorms.length} housing option${dorms.length === 1 ? "" : "s"}`}
          </p>
          {data.housingUrl && (
            <a
              href={data.housingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline"
            >
              Official housing website
            </a>
          )}
        </div>
        <Link href={`/match?college=${data.slug}`}>
          <Button size="lg">Find My Best Dorm</Button>
        </Link>
      </header>

      {rankings.length > 0 && (
        <section aria-labelledby="categorical-rankings">
          <h2 id="categorical-rankings" className="font-display text-2xl tracking-tight">
            At a glance
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Shown only when we have supporting evidence — not guesses.
          </p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rankings.map((r) => (
              <li key={r.label} className="border-l-2 border-primary/40 pl-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{r.label}</p>
                <p className="mt-1 font-medium">{r.name}</p>
              </li>
            ))}
            {highlights.hasCostEvidence !== false && highlights.avgCost > 0 && (
              <li className="border-l-2 border-sage pl-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg listed yearly cost</p>
                <p className="mt-1 font-medium">${Math.round(highlights.avgCost).toLocaleString()}</p>
              </li>
            )}
          </ul>
        </section>
      )}

      {dorms.length > 0 && <CollegeCharts dorms={dorms} />}

      <section>
        <h2 className="font-display text-2xl tracking-tight">All dorms</h2>
        {dorms.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-border bg-card/50 px-6 py-12 text-center">
            <p className="font-medium">No halls on file for this college yet.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Coverage is expanding. Check the official housing site, or explore other schools.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {data.housingUrl && (
                <a href={data.housingUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline">Official housing</Button>
                </a>
              )}
              <Link href="/colleges">
                <Button variant="secondary">Explore colleges</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dorms.map((d) => (
              <DormCard
                key={d.id}
                dorm={{ ...d, college: { name: data.name, slug: data.slug, state: data.state } }}
                collegeAvgCost={highlights.avgCost}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
