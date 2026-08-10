"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const labels: Record<string, string> = {
  valueScore: "Value",
  comfortScore: "Comfort",
  privacyScore: "Privacy",
  socialScore: "Social",
  convenienceScore: "Convenience",
  freshmanFitScore: "Freshman fit",
  amenityScore: "Amenities",
  dataConfidenceScore: "Data confidence",
};

export type ScoreBreakdownData = {
  overallScore: number | null;
  scoreable?: boolean;
  valueScore: number | null;
  comfortScore: number | null;
  privacyScore: number | null;
  socialScore: number | null;
  convenienceScore: number | null;
  freshmanFitScore: number | null;
  amenityScore: number | null;
  dataConfidenceScore: number | null;
};

function formatComponent(val: number | null | undefined): string {
  return val == null ? "Unknown" : String(Math.round(val));
}

export function ScoreBreakdown({ score }: { score: ScoreBreakdownData }) {
  const [open, setOpen] = useState(false);
  const hasOverall = score.overallScore != null && score.scoreable !== false;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Why this score?</CardTitle>
          {!hasOverall && (
            <p className="mt-1 text-sm text-muted-foreground">
              Not enough quality evidence to compute an overall score yet.
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
          {open ? "Hide" : "Show"} breakdown
        </Button>
      </CardHeader>
      {open && (
        <CardContent>
          <div className="space-y-3">
            {Object.entries(labels).map(([key, label]) => {
              const val = score[key as keyof ScoreBreakdownData] as number | null | undefined;
              const known = val != null;
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{label}</span>
                    <span className="font-medium">{formatComponent(val)}</span>
                  </div>
                  {known ? (
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min(100, Math.max(0, val))}%` }}
                      />
                    </div>
                  ) : (
                    <div className="h-2 bg-muted rounded-full" aria-hidden />
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Quality components are weighted separately from data confidence. Data confidence reflects source quality, not housing quality.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
