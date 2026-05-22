"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function HomeSearch() {
  const [q, setQ] = useState("");
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/dorms?q=${encodeURIComponent(q.trim())}`);
    else router.push("/dorms");
  }

  return (
    <form onSubmit={submit} className="flex max-w-2xl mx-auto gap-2 w-full">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          className="pl-10 h-12 text-lg"
          placeholder="Try Santa Clara University, Swig Hall, or California..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <Button type="submit" size="lg" className="h-12 px-8">
        Search
      </Button>
    </form>
  );
}
