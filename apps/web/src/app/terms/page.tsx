import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of use for DormScope.",
};

export default function TermsPage() {
  return (
    <div className="site-container py-10 md:py-14">
      <article className="mx-auto max-w-2xl space-y-6 text-sm leading-relaxed text-muted-foreground">
        <h1 className="font-display text-3xl tracking-tight text-foreground md:text-4xl">Terms of use</h1>
        <p>Last updated: August 2026</p>
        <p>
          DormScope is an independent information service. Content is provided as-is from public sources
          and user contributions. We do not guarantee completeness, accuracy, or fitness for housing
          decisions. Always confirm with your university.
        </p>
        <p>
          You agree not to misuse the service, scrape abusively, submit fraudulent reviews, or attempt to
          disrupt systems. We may remove content that violates guidelines.
        </p>
        <p>
          These terms may be updated; continued use after changes constitutes acceptance of the revised terms.
        </p>
      </article>
    </div>
  );
}
