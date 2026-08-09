import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="site-container space-y-6 py-16" role="status" aria-label="Loading">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-6 w-full max-w-md" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
