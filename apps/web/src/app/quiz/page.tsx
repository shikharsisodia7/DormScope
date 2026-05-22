import { QuizClient } from "@/components/quiz/quiz-client";

export default function QuizPage() {
  return (
    <div className="container py-10 max-w-2xl">
      <h1 className="text-3xl font-bold mb-2">Dorm-fit quiz</h1>
      <p className="text-muted-foreground mb-8">Answer a few questions for weighted dorm recommendations.</p>
      <QuizClient />
    </div>
  );
}
