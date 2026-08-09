import nextDynamic from "next/dynamic";

export const dynamic = "force-dynamic";

const USMap = nextDynamic(() => import("@/components/map/us-map").then((m) => m.USMap), {
  ssr: false,
  loading: () => <p className="site-container py-20 text-center">Loading map...</p>,
});

export default function MapPage() {
  return (
    <div className="site-container py-10">
      <h1 className="font-display text-3xl tracking-tight mb-2">Interactive U.S. map</h1>
      <p className="text-muted-foreground mb-6">Click a college pin to view housing options.</p>
      <USMap />
    </div>
  );
}
