export default function AboutPage() {
  return (
    <div className="container py-10 max-w-3xl prose dark:prose-invert">
      <h1>About DormScope</h1>
      <p>
        DormScope is a nationwide college dorm intelligence platform. We collect public information from
        official university housing websites, rate pages, residence life pages, and campus maps — then
        normalize, score, and present it so students can search, compare, and choose housing with confidence.
      </p>
      <h2>Methodology</h2>
      <ul>
        <li>Only public sources — no logins, paywalls, or private data</li>
        <li>Every field has a confidence score; missing data shows as Unknown</li>
        <li>DormScope Score (0–100) blends value, comfort, privacy, social, convenience, freshman fit, amenities, and data confidence</li>
        <li>Rule-based summaries always work; optional OpenAI for richer text when API key is set</li>
      </ul>
      <h2>Scoring weights</h2>
      <p>Value 15%, Comfort 15%, Privacy 12%, Social 10%, Convenience 10%, Freshman fit 13%, Amenities 12%, Data confidence 13%.</p>
      <h2>Disclaimer</h2>
      <p>
        Data comes from public sources and may be incomplete or outdated. Always verify costs, availability,
        and policies with your university&apos;s official housing office before making decisions.
      </p>
    </div>
  );
}
