import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guidelines",
  description: "Content and review guidelines for DormScope.",
};

export default function GuidelinesPage() {
  return (
    <div className="site-container py-10 md:py-14">
      <article className="mx-auto max-w-2xl space-y-6 text-sm leading-relaxed text-muted-foreground">
        <h1 className="font-display text-3xl tracking-tight text-foreground md:text-4xl">Guidelines</h1>
        <ul className="list-disc space-y-2 pl-5">
          <li>Be honest and specific about living conditions you experienced.</li>
          <li>No hate speech, harassment, doxxing, or illegal content.</li>
          <li>No spam, advertising, or fake reviews.</li>
          <li>Do not include personal contact info or room numbers that identify others.</li>
          <li>Corrections to facts should cite a public source when possible.</li>
        </ul>
        <p>Reviews are moderated. Violations may be removed and repeat abuse may be blocked.</p>
      </article>
    </div>
  );
}
