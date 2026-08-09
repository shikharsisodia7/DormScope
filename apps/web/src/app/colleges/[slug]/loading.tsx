import { Skeleton } from "@/components/ui/skeleton";

export default function CollegeLoading() {
  return (
    <div className="site-container space-y-8 py-10" role="status" aria-label="Loading college">
      <Skeleton className="h-12 w-80" />
      <Skeleton className="h-6 w-48" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    </div>
  );
}
