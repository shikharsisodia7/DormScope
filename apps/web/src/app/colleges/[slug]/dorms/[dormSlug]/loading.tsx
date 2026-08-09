import { Skeleton } from "@/components/ui/skeleton";

export default function DormLoading() {
  return (
    <div className="site-container space-y-8 py-10" role="status" aria-label="Loading dorm">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-12 w-72" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
