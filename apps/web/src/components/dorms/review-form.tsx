"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_URL } from "@/lib/utils";

export function ReviewForm({ dormId }: { dormId: string }) {
  const [overallRating, setOverallRating] = useState(4);
  const [pros, setPros] = useState("");
  const [cons, setCons] = useState("");
  const [advice, setAdvice] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");
    try {
      const res = await fetch(`${API_URL}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dormId,
          overallRating,
          pros: pros || undefined,
          cons: cons || undefined,
          advice: advice || undefined,
          schoolYear: schoolYear || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not submit review");
      setStatus("ok");
      setMessage(data.message || "Review submitted for moderation.");
      setPros("");
      setCons("");
      setAdvice("");
    } catch (err) {
      setStatus("err");
      setMessage(err instanceof Error ? err.message : "Submission failed");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div>
        <h3 className="font-display text-xl">Write a review</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Reviews are moderated before they appear. Be specific and kind — follow community guidelines.
        </p>
      </div>

      <div>
        <label htmlFor="rating" className="text-sm font-medium">
          Overall rating
        </label>
        <select
          id="rating"
          className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={overallRating}
          onChange={(e) => setOverallRating(Number(e.target.value))}
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} / 5
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="school-year" className="text-sm font-medium">
          School year lived (optional)
        </label>
        <Input
          id="school-year"
          className="mt-1"
          value={schoolYear}
          onChange={(e) => setSchoolYear(e.target.value)}
          placeholder="e.g. First-year, 2024–25"
        />
      </div>

      <div>
        <label htmlFor="pros" className="text-sm font-medium">
          Pros
        </label>
        <textarea
          id="pros"
          className="mt-1 min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={pros}
          onChange={(e) => setPros(e.target.value)}
          maxLength={2000}
        />
      </div>

      <div>
        <label htmlFor="cons" className="text-sm font-medium">
          Cons
        </label>
        <textarea
          id="cons"
          className="mt-1 min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={cons}
          onChange={(e) => setCons(e.target.value)}
          maxLength={2000}
        />
      </div>

      <div>
        <label htmlFor="advice" className="text-sm font-medium">
          Advice for future residents
        </label>
        <textarea
          id="advice"
          className="mt-1 min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={advice}
          onChange={(e) => setAdvice(e.target.value)}
          maxLength={2000}
        />
      </div>

      {message && (
        <p
          className={status === "err" ? "text-sm text-destructive" : "text-sm text-primary"}
          role="status"
        >
          {message}
        </p>
      )}

      <Button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Submitting…" : "Submit review"}
      </Button>
    </form>
  );
}
