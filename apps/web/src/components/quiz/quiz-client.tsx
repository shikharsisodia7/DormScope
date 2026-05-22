"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_URL } from "@/lib/utils";

interface Ranked {
  matchScore: number;
  explanation: string;
  dorm: { id: string; name: string; collegeName: string; slug?: string };
}

export function QuizClient() {
  const [step, setStep] = useState(0);
  const [results, setResults] = useState<Ranked[] | null>(null);
  const [answers, setAnswers] = useState({
    isFreshman: true,
    prefersSocial: true,
    prefersQuiet: false,
    priorityPrice: 7,
    priorityComfort: 5,
    priorityPrivacy: 5,
    priorityLocation: 5,
    wantsAC: true,
    bathroomPreference: "suite" as const,
    nearDining: true,
    apartmentStyle: false,
    honorsThemed: false,
    studyLounges: true,
    cheapestVsBestFit: "best_fit" as const,
    collegeSlug: "santa-clara-university",
  });

  const questions = [
    { key: "isFreshman", label: "Are you a freshman?", type: "bool" },
    { key: "prefersSocial", label: "Do you want a social dorm?", type: "bool" },
    { key: "prefersQuiet", label: "Do you prefer a quiet dorm?", type: "bool" },
    { key: "wantsAC", label: "Do you want AC?", type: "bool" },
    { key: "bathroomPreference", label: "Bathroom preference", type: "select", options: ["communal", "suite", "private"] },
    { key: "apartmentStyle", label: "Apartment-style housing?", type: "bool" },
    { key: "cheapestVsBestFit", label: "Cheapest or best overall fit?", type: "select", options: ["cheapest", "best_fit"] },
  ];

  async function finish() {
    const res = await fetch(`${API_URL}/api/recommend/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(answers),
    });
    setResults(await res.json());
  }

  useEffect(() => {
    if (step >= questions.length && !results) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (results) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Your recommendations</h2>
        {results.map((r, i) => (
          <Card key={r.dorm.id}>
            <CardHeader>
              <CardTitle className="text-lg">
                #{i + 1} {r.dorm.name} — {r.matchScore}% match
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{r.explanation}</p>
              <p className="text-sm mt-1">{r.dorm.collegeName}</p>
            </CardContent>
          </Card>
        ))}
        <Button onClick={() => setResults(null)}>Retake quiz</Button>
      </div>
    );
  }

  if (step >= questions.length && !results) {
    return <p>Calculating recommendations...</p>;
  }

  const q = questions[step];

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Question {step + 1} of {questions.length}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p>{q.label}</p>
        {q.type === "bool" && (
          <div className="flex gap-2">
            <Button onClick={() => { setAnswers({ ...answers, [q.key]: true }); setStep(step + 1); }}>Yes</Button>
            <Button variant="outline" onClick={() => { setAnswers({ ...answers, [q.key]: false }); setStep(step + 1); }}>No</Button>
          </div>
        )}
        {q.type === "select" && q.options && (
          <div className="flex flex-wrap gap-2">
            {q.options.map((opt) => (
              <Button
                key={opt}
                variant="secondary"
                onClick={() => {
                  setAnswers({ ...answers, [q.key]: opt });
                  setStep(step + 1);
                }}
              >
                {opt}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
