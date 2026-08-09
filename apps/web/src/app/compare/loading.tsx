import { Skeleton } from "@/components/ui/skeleton";

export default function CompareLoading() {
  return (
    <div className="site-container space-y-6 py-10" role="status" aria-label="Loading comparison">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
