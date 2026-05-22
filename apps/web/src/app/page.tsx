import Link from "next/link";
import { Search, BarChart3, Map, Scale, Sparkles, DollarSign, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HomeSearch } from "@/components/home/home-search";
import { fetchApi } from "@/lib/utils";

interface Stats {
  totalColleges: number;
  totalDorms: number;
  totalSources: number;
  avgConfidence: number;
  statesCovered: number;
}

async function getStats(): Promise<Stats> {
  try {
    return await fetchApi<Stats>("/api/stats");
  } catch {
    return { totalColleges: 5, totalDorms: 14, totalSources: 5, avgConfidence: 88, statesCovered: 5 };
  }
}

export default async function HomePage() {
  const stats = await getStats();

  const features = [
    { href: "/compare", icon: Scale, title: "Compare dorms", desc: "Side-by-side up to 4 dorms" },
    { href: "/dorms?freshmanOnly=true", icon: Building, title: "Freshman housing", desc: "Best halls for first-years" },
    { href: "/dorms", icon: Sparkles, title: "Search by amenities", desc: "AC, suite baths, laundry & more" },
    { href: "/analytics", icon: DollarSign, title: "View dorm costs", desc: "National cost trends by state" },
    { href: "/map", icon: Map, title: "Explore housing maps", desc: "Colleges across the U.S." },
    { href: "/quiz", icon: BarChart3, title: "Dorm-fit quiz", desc: "Personalized recommendations" },
  ];

  return (
    <div>
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/5 to-background py-20 md:py-28">
        <div className="container text-center space-y-8">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-4xl mx-auto">
            Search any college dorm in the U.S.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            DormScope collects public housing data, scores every residence hall, and helps you compare
            costs, amenities, and fit — like Zillow for college dorms.
          </p>
          <HomeSearch />
        </div>
      </section>

      <section className="container py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Colleges indexed", value: stats.totalColleges },
            { label: "Dorms indexed", value: stats.totalDorms },
            { label: "Sources scanned", value: stats.totalSources },
            { label: "Avg confidence", value: `${stats.avgConfidence}%` },
            { label: "States covered", value: stats.statesCovered },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-primary">{s.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container py-8">
        <h2 className="text-2xl font-bold mb-6">Explore DormScope</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <Link key={f.href} href={f.href}>
              <Card className="h-full hover:border-primary transition-colors cursor-pointer">
                <CardHeader>
                  <f.icon className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">{f.title}</CardTitle>
                  <CardDescription>{f.desc}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="container py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Featured colleges</h2>
          <Link href="/colleges">
            <Button variant="outline">View all</Button>
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { name: "Santa Clara University", slug: "santa-clara-university", state: "CA" },
            { name: "University of Michigan", slug: "university-of-michigan", state: "MI" },
            { name: "University of Texas at Austin", slug: "university-of-texas-at-austin", state: "TX" },
          ].map((c) => (
            <Link key={c.slug} href={`/colleges/${c.slug}`}>
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle>{c.name}</CardTitle>
                  <CardDescription>{c.state} · View all dorms →</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-muted/50 py-16">
        <div className="container text-center max-w-2xl">
          <Search className="h-10 w-10 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Built to scale nationwide</h2>
          <p className="text-muted-foreground">
            Seed data powers the demo. The scraper pipeline, confidence scoring, and admin tools are
            designed to index every U.S. college over time.
          </p>
          <Link href="/about">
            <Button className="mt-6">How DormScope works</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
