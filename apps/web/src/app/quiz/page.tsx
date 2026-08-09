import { redirect } from "next/navigation";

export default function QuizRedirectPage({
  searchParams,
}: {
  searchParams: { college?: string };
}) {
  const q = searchParams.college ? `?college=${encodeURIComponent(searchParams.college)}` : "";
  redirect(`/match${q}`);
}
