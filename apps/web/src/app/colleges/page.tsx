import Link from "next/link";
import { Suspense } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CollegeSearch } from "@/components/colleges/college-search";
import { fetchApi } from "@/lib/utils";

interface College {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  schoolType: string;
  _count: { dorms: number };
}

async function CollegeList({ searchParams }: { searchParams: { q?: string; state?: string } }) {
  const params = new URLSearchParams();
  if (searchParams.q) params.set("q", searchParams.q);
  if (searchParams.state) params.set("state", searchParams.state);

  let colleges: College[] = [];
  try {
    colleges = await fetchApi<College[]>(`/api/colleges?${params}`);
  } catch {
    colleges = [];
  }

  if (colleges.length === 0) {
    return <p className="text-muted-foreground text-center py-12">No colleges found. Start the API and seed the database.</p>;
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {colleges.map((c) => (
        <Link key={c.id} href={`/colleges/${c.slug}`}>
          <Card className="hover:shadow-md h-full">
            <CardHeader>
              <CardTitle>{c.name}</CardTitle>
              <CardDescription>
                {c.city}, {c.state} · {c._count.dorms} dorms · {c.schoolType}
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export default function CollegesPage({
  searchParams,
}: {
  searchParams: { q?: string; state?: string };
}) {
  return (
    <div className="container py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">College search</h1>
        <p className="text-muted-foreground mt-2">Find any school and explore all on-campus housing.</p>
      </div>
      <Suspense fallback={<div>Loading filters...</div>}>
        <CollegeSearch />
      </Suspense>
      <CollegeList searchParams={searchParams} />
    </div>
  );
}
