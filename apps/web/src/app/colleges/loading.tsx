import { Skeleton } from "@/components/ui/skeleton";

export default function CollegesLoading() {
  return (
    <div className="site-container space-y-6 py-10" role="status" aria-label="Loading colleges">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-12 w-full max-w-xl" />
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
