import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "How rankings work",
  description: "How DormScope personalized dorm rankings, confidence, and hard requirements work.",
};

export default function HowRankingsWorkPage() {
  return (
    <div className="site-container py-10 md:py-14">
      <article className="mx-auto max-w-2xl space-y-8">
        <header>
          <h1 className="font-display text-3xl tracking-tight md:text-4xl">How rankings work</h1>
          <p className="mt-3 text-muted-foreground">
            Transparent, preference-driven ranking — not a black-box popularity contest.
          </p>
        </header>

        <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="font-display text-xl text-foreground">1. Soft weights</h2>
          <p>
            Dimensions like social atmosphere, quiet, space, bathroom privacy, AC, affordability, and
            location each have an importance from skip to must-have feel. Higher weights pull matching
            halls up the list.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="font-display text-xl text-foreground">2. Hard requirements</h2>
          <p>
            Optional filters (private bath, AC, freshman-eligible, budget cap, and more) exclude halls
            that fail. If evidence is missing, the hall is not excluded — we surface unknowns instead.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="font-display text-xl text-foreground">3. Match score & confidence</h2>
          <p>
            Match percent reflects fit to your profile. Confidence reflects how much evidence we have
            for the dimensions you care about. Amber scores are match signals — not school branding.
          </p>
        </section>

        <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="font-display text-xl text-foreground">4. Explanations</h2>
          <p>
            Each result can show reasons it fits, tradeoffs, and unknowns. Use fine-tune to re-rank
            after adjusting weights.
          </p>
        </section>

        <Link href="/match">
          <Button>Try Find My Best Dorm</Button>
        </Link>
      </article>
    </div>
  );
}
