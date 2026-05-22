import { notFound } from "next/navigation";
import { DormCard, type DormCardData } from "@/components/dorms/dorm-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    cheapest?: { name: string; yearlyCost?: number };
    expensive?: { name: string; yearlyCost?: number };
    bestFreshman?: { name: string };
    bestValue?: { name: string };
    mostSocial?: { name: string };
    quietest?: { name: string };
  };
}

export default async function CollegePage({ params }: { params: { slug: string } }) {
  let data: CollegePageData;
  try {
    data = await fetchApi<CollegePageData>(`/api/colleges/${params.slug}`);
  } catch {
    notFound();
  }

  const { highlights, dorms } = data;

  return (
    <div className="container py-10 space-y-10">
      <div>
        <h1 className="text-3xl font-bold">{data.name}</h1>
        <p className="text-muted-foreground">
          {data.city}, {data.state} · {dorms.length} housing options
        </p>
        {data.housingUrl && (
          <a href={data.housingUrl} target="_blank" rel="noopener noreferrer" className="text-primary text-sm hover:underline mt-2 inline-block">
            Official housing website →
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg cost</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">${Math.round(highlights.avgCost).toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Cheapest</CardTitle></CardHeader>
          <CardContent><p className="font-medium">{highlights.cheapest?.name ?? "—"}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Best freshman</CardTitle></CardHeader>
          <CardContent><p className="font-medium">{highlights.bestFreshman?.name ?? "—"}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Most social</CardTitle></CardHeader>
          <CardContent><p className="font-medium">{highlights.mostSocial?.name ?? "—"}</p></CardContent>
        </Card>
      </div>

      <CollegeCharts dorms={dorms} />

      <div>
        <h2 className="text-2xl font-bold mb-4">All dorms</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dorms.map((d) => (
            <DormCard key={d.id} dorm={{ ...d, college: { name: data.name, slug: data.slug, state: data.state } }} collegeAvgCost={highlights.avgCost} />
          ))}
        </div>
      </div>
    </div>
  );
}
