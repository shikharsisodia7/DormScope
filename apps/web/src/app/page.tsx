import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HomeSearch } from "@/components/home/home-search";
import { SectionReveal } from "@/components/ui/section-reveal";
import { prisma } from "@/lib/prisma";

interface Stats {
  totalColleges: number;
  totalDorms: number;
  totalSources: number;
  avgConfidence: number;
  statesCovered: number;
}

interface CollegeItem {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  dormCount?: number;
}

async function getStats(): Promise<Stats | null> {
  try {
    const [colleges, dorms, sources, confidence, states] = await Promise.all([
      prisma.college.count(),
      prisma.dorm.count(),
      prisma.source.count(),
      prisma.dorm.aggregate({ _avg: { confidenceScore: true } }),
      prisma.college.findMany({ select: { state: true }, distinct: ["state"] }),
    ]);
    return {
      totalColleges: colleges,
      totalDorms: dorms,
      totalSources: sources,
      avgConfidence: Math.round((confidence._avg.confidenceScore ?? 0) * 100),
      statesCovered: states.length,
    };
  } catch {
    return null;
  }
}

async function getFeaturedColleges(): Promise<CollegeItem[]> {
  try {
    const rows = await prisma.college.findMany({
      where: { dorms: { some: {} } },
      include: { _count: { select: { dorms: true } } },
      orderBy: { name: "asc" },
      take: 6,
    });
    return rows.slice(0, 3).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      city: c.city,
      state: c.state,
      dormCount: c._count.dorms,
    }));
  } catch {
    return [];
  }
}

const steps = [
  {
    n: "01",
    title: "Choose your college",
    body: "Search by name or nickname. We only rank halls for the school you pick.",
  },
  {
    n: "02",
    title: "Say what matters",
    body: "Social vibe, quiet, space, private bath, AC, cost, location — set soft weights or hard requirements.",
  },
  {
    n: "03",
    title: "Get dorms ranked for you",
    body: "See match percent, confidence, reasons, and tradeoffs. Fine-tune and re-rank anytime.",
  },
];

export default async function HomePage() {
  const [stats, featured] = await Promise.all([getStats(), getFeaturedColleges()]);

  return (
    <div>
      <section className="campus-hero relative overflow-hidden border-b border-border/60">
        <div className="site-container flex min-h-[min(88vh,720px)] flex-col justify-center py-16 md:py-24">
          <p className="fade-up font-display text-4xl tracking-tight text-forest sm:text-5xl md:text-6xl">
            DormScope
          </p>
          <h1 className="fade-up fade-up-delay-1 mt-5 max-w-2xl font-display text-3xl leading-tight tracking-tight text-foreground sm:text-4xl md:text-[2.75rem]">
            Find the dorm that fits how you want to live.
          </h1>
          <p className="fade-up fade-up-delay-2 mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
            Choose your college → say what matters → get dorms ranked for you.
          </p>
          <div className="fade-up fade-up-delay-3 mt-10">
            <HomeSearch />
          </div>
          <div className="fade-up fade-up-delay-3 mt-6 flex flex-wrap items-center gap-4 text-sm">
            <Link href="/match" className="font-medium text-primary underline-offset-4 hover:underline">
              Find My Best Dorm
            </Link>
            <span className="text-border" aria-hidden>
              ·
            </span>
            <Link href="/how-rankings-work" className="text-muted-foreground underline-offset-4 hover:underline">
              How rankings work
            </Link>
          </div>
        </div>
      </section>

      {stats && (
        <SectionReveal className="border-b border-border/50 bg-card/40">
          <div className="site-container py-10">
            <p className="text-sm font-medium text-muted-foreground">Current coverage</p>
            <dl className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Colleges</dt>
                <dd className="mt-1 font-display text-3xl text-forest">{stats.totalColleges}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Halls</dt>
                <dd className="mt-1 font-display text-3xl text-forest">{stats.totalDorms}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">States</dt>
                <dd className="mt-1 font-display text-3xl text-forest">{stats.statesCovered}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Sources</dt>
                <dd className="mt-1 font-display text-3xl text-forest">{stats.totalSources}</dd>
              </div>
            </dl>
          </div>
        </SectionReveal>
      )}

      <SectionReveal id="how-it-works" className="site-container py-20 md:py-28">
        <h2 className="font-display text-3xl tracking-tight text-foreground md:text-4xl">How it works</h2>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Three steps. No quiz gimmicks — preferences map directly to how we rank halls.
        </p>
        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {steps.map((s) => (
            <li key={s.n} className="relative">
              <span className="font-display text-sm text-sage">{s.n}</span>
              <h3 className="mt-2 font-display text-xl text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12">
          <Link href="/match">
            <Button size="lg">Start Find My Best Dorm</Button>
          </Link>
        </div>
      </SectionReveal>

      {featured.length > 0 && (
        <SectionReveal className="border-t border-border/50 bg-secondary/30">
          <div className="site-container py-16 md:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl tracking-tight">Explore colleges</h2>
                <p className="mt-2 text-muted-foreground">Schools with housing data in DormScope today.</p>
              </div>
              <Link href="/colleges">
                <Button variant="outline">View all</Button>
              </Link>
            </div>
            <ul className="mt-10 divide-y divide-border/70 border-y border-border/70">
              {featured.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/colleges/${c.slug}`}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-5 transition-colors hover:text-primary"
                  >
                    <span className="font-display text-xl">{c.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {c.city}, {c.state}
                      {c.dormCount != null ? ` · ${c.dormCount} halls` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </SectionReveal>
      )}

      <SectionReveal className="site-container py-20 text-center md:py-24">
        <h2 className="font-display text-3xl tracking-tight">Ready when you are</h2>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          Pick a college and we&apos;ll rank halls against what you actually care about.
        </p>
        <Link href="/match" className="mt-8 inline-block">
          <Button size="lg">Find My Best Dorm</Button>
        </Link>
      </SectionReveal>
    </div>
  );
}
