import { MatchClient } from "@/components/match/match-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find My Best Dorm",
  description:
    "Pick your college, say what matters, and get personalized dorm rankings with match scores, confidence, and honest unknowns.",
};

export default function MatchPage({
  searchParams,
}: {
  searchParams: { college?: string };
}) {
  return (
    <div className="site-container py-10 md:py-14">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl tracking-tight md:text-4xl">Find My Best Dorm</h1>
        <p className="mt-2 text-muted-foreground">
          Choose your college → say what matters → get dorms ranked for you.
        </p>
        <div className="mt-10">
          <MatchClient collegeSlug={searchParams.college} />
        </div>
      </div>
    </div>
  );
}
