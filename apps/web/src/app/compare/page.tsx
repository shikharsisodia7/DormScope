import { CompareClient } from "@/components/compare/compare-client";

export default function ComparePage() {
  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-2">Dorm comparison</h1>
      <p className="text-muted-foreground mb-8">Compare 2–4 dorms side by side with automatic recommendations.</p>
      <CompareClient />
    </div>
  );
}
