import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community",
  description: "How students contribute reviews and corrections to DormScope.",
};

export default function CommunityPage() {
  return (
    <div className="site-container py-10 md:py-14">
      <article className="mx-auto max-w-2xl space-y-6 text-sm leading-relaxed text-muted-foreground">
        <h1 className="font-display text-3xl tracking-tight text-foreground md:text-4xl">Community</h1>
        <p>
          DormScope gets better when students share lived experience — carefully. Reviews appear after
          moderation. Corrections help us fix public facts that change each year.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Write a review from any dorm page — see{" "}
            <Link href="/guidelines" className="text-primary underline-offset-4 hover:underline">
              Guidelines
            </Link>
            .
          </li>
          <li>Be respectful of roommates and staff; criticize conditions, not people.</li>
          <li>Remember: we are independent of universities. Official policies always win.</li>
        </ul>
      </article>
    </div>
  );
}
