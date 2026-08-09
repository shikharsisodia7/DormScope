import { Skeleton } from "@/components/ui/skeleton";

export default function MatchLoading() {
  return (
    <div className="site-container mx-auto max-w-2xl space-y-6 py-10" role="status" aria-label="Loading match">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-5 w-full max-w-md" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
