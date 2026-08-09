import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "DormScope privacy policy — what we collect and how we use it.",
};

export default function PrivacyPage() {
  return (
    <div className="site-container py-10 md:py-14">
      <article className="mx-auto max-w-2xl space-y-6 text-sm leading-relaxed text-muted-foreground">
        <h1 className="font-display text-3xl tracking-tight text-foreground md:text-4xl">Privacy</h1>
        <p>Last updated: August 2026</p>
        <section className="space-y-3">
          <h2 className="font-display text-xl text-foreground">What we collect</h2>
          <p>
            DormScope may store match preferences you submit, optional guest favorites in your browser,
            and review submissions (including optional school year and free-text). Server logs may
            include IP-derived hashes for rate limiting — not for advertising profiles.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl text-foreground">How we use data</h2>
          <p>
            Preferences power rankings. Reviews are moderated before publication. We do not sell personal
            information. Analytics, if enabled, are used to improve product reliability.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl text-foreground">Contact</h2>
          <p>
            For privacy questions, reach out via the contact method listed on the About page when available.
          </p>
        </section>
      </article>
    </div>
  );
}
