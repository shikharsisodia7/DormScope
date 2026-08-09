import type { Metadata } from "next";
import { CompareClient } from "@/components/compare/compare-client";

export const metadata: Metadata = {
  title: "Compare dorms",
  description: "Side-by-side dorm comparison with clear Unknown vs No labeling.",
};

export default function ComparePage() {
  return (
    <div className="site-container py-10 md:py-14">
      <h1 className="font-display text-3xl tracking-tight md:text-4xl">Compare dorms</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Up to four halls side by side. Missing facts show as Unknown — never as No.
      </p>
      <div className="mt-8">
        <CompareClient />
      </div>
    </div>
  );
}
