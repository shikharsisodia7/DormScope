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

export function ScoreBreakdown({
  score,
}: {
  score: {
    overallScore: number;
    valueScore: number;
    comfortScore: number;
    privacyScore: number;
    socialScore: number;
    convenienceScore: number;
    freshmanFitScore: number;
    amenityScore: number;
    dataConfidenceScore: number;
  };
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Why this score?</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
          {open ? "Hide" : "Show"} breakdown
        </Button>
      </CardHeader>
      {open && (
        <CardContent>
          <div className="space-y-3">
            {Object.entries(labels).map(([key, label]) => {
              const val = score[key as keyof typeof score] as number;
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{label}</span>
                    <span className="font-medium">{val}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${val}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Weighted blend: value 15%, comfort 15%, privacy 12%, social 10%, convenience 10%, freshman fit 13%, amenities 12%, data confidence 13%.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
