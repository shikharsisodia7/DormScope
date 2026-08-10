"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface Job {
  id: string;
  status: string;
  dormsFound: number;
  errorMessage?: string | null;
  college: { name: string; slug: string };
  logs: { level: string; message: string; createdAt: string | Date }[];
}

export function ScraperDashboard({ initialJobs }: { initialJobs: Job[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [slug, setSlug] = useState("santa-clara-university");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function queueRefresh() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/scraper/run/${encodeURIComponent(slug)}`, { method: "POST" });
      const body = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setMessage(body.error ?? "Failed to queue refresh.");
        return;
      }
      setMessage(body.message ?? "Queued. Waiting for background worker.");
      const jobsRes = await fetch("/api/scraper/jobs");
      if (jobsRes.ok) setJobs(await jobsRes.json());
    } catch {
      setMessage("Request failed. Sign in as an admin and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input placeholder="college-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <Button onClick={queueRefresh} disabled={busy}>
          {busy ? "Queueing…" : "Queue refresh"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        This marks an ingest checkpoint as queued. Processing happens via{" "}
        <code className="text-xs">npm run scraper -- &lt;college-slug&gt;</code> or{" "}
        <code className="text-xs">npm run scraper:nationwide</code> — not in Vercel serverless.
      </p>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {jobs.map((job) => (
        <Card key={job.id}>
          <CardHeader>
            <CardTitle className="text-lg">
              {job.college.name} — {job.status} ({job.dormsFound} dorms)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {job.errorMessage && <p className="text-red-500">{job.errorMessage}</p>}
            {job.logs?.map((l, i) => (
              <p key={i} className="text-muted-foreground">
                [{l.level}] {l.message}
              </p>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
