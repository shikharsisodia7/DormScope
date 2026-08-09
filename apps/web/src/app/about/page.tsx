import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About",
  description: "What DormScope is, how we use public housing data, and how to verify with your university.",
};

export default function AboutPage() {
  return (
    <div className="site-container py-10 md:py-14">
      <article className="mx-auto max-w-2xl space-y-8">
        <header>
          <h1 className="font-display text-3xl tracking-tight md:text-4xl">About DormScope</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Independent dorm intelligence for students choosing where to live on campus.
          </p>
        </header>

        <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            DormScope helps you pick a college, say what matters, and get residence halls ranked for
            you — with match scores, confidence, reasons, and clear unknowns when we lack evidence.
          </p>
          <p>
            We collect information from public university housing pages and related public sources.
            We are not affiliated with any school. Always verify costs, eligibility, and policies with
            your university&apos;s official housing office before you decide.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl">How we work</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Public sources only — no logins or paywalled data</li>
            <li>Missing facts show as Unknown, never as invented Yes/No</li>
            <li>Personalized ranking uses your weights and optional hard requirements</li>
            <li>Coverage grows over time; empty colleges show an honest empty state</li>
          </ul>
        </section>

        <section className="flex flex-wrap gap-3">
          <Link href="/match">
            <Button>Find My Best Dorm</Button>
          </Link>
          <Link href="/how-rankings-work">
            <Button variant="outline">How rankings work</Button>
          </Link>
          <Link href="/community">
            <Button variant="ghost">Community</Button>
          </Link>
        </section>
      </article>
    </div>
  );
}
