import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="site-container flex min-h-[50vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-display text-sm text-sage">404</p>
      <h1 className="mt-2 font-display text-3xl tracking-tight">Page not found</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        That route doesn&apos;t exist — or the college/dorm isn&apos;t in our index yet.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/">
          <Button>Home</Button>
        </Link>
        <Link href="/colleges">
          <Button variant="outline">Explore colleges</Button>
        </Link>
        <Link href="/match">
          <Button variant="secondary">Find My Best Dorm</Button>
        </Link>
      </div>
    </div>
  );
}
