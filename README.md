# DormScope

Personalized dorm ranking for U.S. colleges — pick a school, set what matters (soft preferences and optional hard requirements), and get match scores with confidence and honest unknowns.

Production runs as a Next.js app on Vercel with Neon Postgres. Residence-hall coverage grows via official directory seeding and a local scraper CLI; missing attributes are unknowns, not “no.”

## Tech stack

| Layer | Technology |
|--------|------------|
| App + API | Next.js 14 (App Router) — product UI and `/api/*` route handlers on Vercel |
| Optional API | Express (`apps/api`) for local/alternate deployments |
| Database | Neon Postgres + Prisma (`@dormscope/database`) |
| Ranking | `@dormscope/scoring` + preference registry in `@dormscope/shared` |
| Ingestion | College Scorecard institution import; official hall directory seed; Playwright/Cheerio scraper CLI |
| Maps / charts | Leaflet, Recharts |
| Auth | Clerk-ready; guest favorites via `localStorage` |
| Deploy | Vercel project **dormscope**; scraper is **not** run on Vercel serverless |

## Monorepo

```txt
dormscope/
  apps/
    web/          # Next.js UI + /api routes (production API)
    api/          # Optional Express REST API
  packages/
    database/     # Prisma schema, seed, import/coverage scripts
    scoring/      # Personalized ranker + DormScope Score helpers
    scraper/      # CLI discovery/extraction (SSRF-gated)
    shared/       # Types, preference registry, normalization
  docs/
  vercel.json
```

## Setup

Prerequisites: Node.js 20+, a Postgres database (Neon recommended).

```bash
npm install
cp .env.example .env   # set DATABASE_URL; leave NEXT_PUBLIC_API_URL empty for same-origin /api
npm run db:push
npm run db:seed        # amenities + admin catalog only — does not fabricate dorms/reviews
```

Populate institutions and halls:

```bash
# Prefer local Scorecard zip (faster/reliable). Requires optional adm-zip.
# IMPORT_SOURCE=auto|csv|api (default auto)
set SCORECARD_ZIP_PATH=C:\path\to\Most-Recent-Cohorts-Institution.zip   # Windows
# export SCORECARD_ZIP_PATH=/path/to/zip                                # macOS/Linux
npm run db:import-institutions

npm run db:seed-halls    # official residence-hall directory seed (progressive)
npm run db:coverage      # institution / housing coverage report
```

See [.env.example](.env.example) for `DATABASE_URL`, `ADMIN_API_KEY`, `NEXT_PUBLIC_API_URL`, Scorecard, Clerk, Redis, and scraper settings.

## Development

```bash
npm run dev:web          # http://localhost:3000 — uses Next.js /api when NEXT_PUBLIC_API_URL is empty
```

Optional Express API (point `NEXT_PUBLIC_API_URL` at it if you use this path):

```bash
npm run dev:api          # http://localhost:4000
```

Scraper CLI (local/long-running — not for Vercel serverless):

```bash
npm run scraper -- <college-slug>
```

## Ranking architecture

- **Preference registry** (`packages/shared`) — single source of truth for soft dimensions and hard-capable constraints; exposed via `/api/preferences/definitions`.
- **Hard vs soft** — hard constraints filter halls *before* scoring; missing evidence does **not** fail a hard check (hall stays eligible; unknowns are surfaced). Soft weights (0–4) drive the match score.
- **Confidence ≠ match** — match reflects fit to the profile; confidence reflects evidence coverage for the dimensions you care about.
- **Algorithm version** — ranked results include `algorithmVersion` (currently `1.0.0` in `@dormscope/scoring`).

Product explanation: [/how-rankings-work](apps/web/src/app/how-rankings-work/page.tsx).

## Data ingestion

1. **Institutions** — College Scorecard import (`db:import-institutions`) loads the US college catalog.
2. **Official hall directories** — progressive seed of known residence halls (`db:seed-halls`).
3. **Nationwide scraper** — discovers housing pages and extracts hall names for colleges still missing halls:

```bash
# largest ~400 schools without halls yet (enrollment ≥ 2000)
npm run scraper:nationwide

# customize
set MIN_ENROLLMENT=1000
set LIMIT=1000
set CONCURRENCY=4
npm run scraper:nationwide

# single college
npm run scraper -- university-of-california-berkeley
```

Hall attributes stay unknown unless published. Scraped halls are never auto-verified.
Unknown attributes are stored/displayed as unknown — they are never treated as false.

## Tests

```bash
npm test                    # unit (scoring + scraper + web)
npm run test:integration    # Postgres integration (set DATABASE_URL_TEST or ALLOW_TEST_ON_DEV_DB=1)
npm run test:e2e            # Playwright web E2E (local server or E2E_BASE_URL)
npm run release:check       # typecheck + unit + integration + lint + build + e2e
```

Integration tests expect an isolated Postgres URL via `DATABASE_URL_TEST` (CI service) or, for local dry-runs against a non-production DB only, `ALLOW_TEST_ON_DEV_DB=1`.

## Admin auth

Admin UI uses Clerk + allowlist:

- `ADMIN_USER_IDS` — comma-separated Clerk user IDs
- `ADMIN_EMAILS` — comma-separated emails

If `CLERK_SECRET_KEY` is set but both allowlists are empty, admin pages fail with an explicit configuration error (not a silent redirect). Mutating admin APIs also accept `ADMIN_API_KEY` / `x-admin-key`.

## Scraper / data ops

```bash
# Worker modes: discover | extract | enrich | hierarchy | validate | nationwide
set MODE=enrich
npm run scraper:nationwide

# Hierarchy enrichment (APPLY=1 to write)
set APPLY=1
npm run scraper:hierarchy

# Quarantine high-confidence junk names (never hard-delete)
set APPLY=1
npm run db:quarantine-junk

# Recompute quality scores after enrichment
set APPLY=1
npm run db:recompute-scores

# Coverage / audits
npm run db:coverage
```

Durable public write rate limiting uses Redis when `REDIS_URL` is set; otherwise a Postgres `RateLimitBucket` table.

## Deploy (Vercel)

- Project: **dormscope** (`vercel.json` builds `@dormscope/web` after `db:generate`)
- Required env: `DATABASE_URL` (Neon), `ADMIN_API_KEY` (mutating admin/scraper routes)
- Set `NEXT_PUBLIC_API_URL` to **empty** so the app uses same-origin `/api` routes
- Do not rely on Vercel serverless for Playwright scraping
- Configure `ADMIN_USER_IDS` and/or `ADMIN_EMAILS` when Clerk is enabled

## Coverage (honest)

- **Institutions** come from College Scorecard (national higher-ed catalog).
- **Residence halls** are seeded and ingested progressively — not every college has hall-level data yet.
- **Unknown ≠ false**: lack of evidence does not mean a feature is absent.
- There is **no** claim of complete nationwide hall attribute coverage or fabricated “production-complete” dorm datasets. `db:seed` only loads catalog amenities (and an admin user), not fake dorms or reviews.

## Disclaimer

DormScope uses public sources. Data may be incomplete or outdated. Always verify with the university’s official housing office before deciding.

## License

MIT — portfolio / educational use.
