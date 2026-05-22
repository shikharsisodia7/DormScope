"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { API_URL } from "@/lib/utils";
import { useState } from "react";

interface Job {
  id: string;
  status: string;
  dormsFound: number;
  errorMessage?: string;
  college: { name: string; slug: string };
  logs: { level: string; message: string; createdAt: string }[];
}

export function ScraperDashboard({ initialJobs }: { initialJobs: Job[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [slug, setSlug] = useState("santa-clara-university");

  async function runScrape() {
    await fetch(`${API_URL}/api/scraper/run/${slug}`, { method: "POST" });
    const res = await fetch(`${API_URL}/api/scraper/jobs`);
    setJobs(await res.json());
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Input placeholder="college-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <Button onClick={runScrape}>Run scraper</Button>
      </div>
      <p className="text-sm text-muted-foreground">CLI: npm run scraper -- santa-clara-university</p>
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
