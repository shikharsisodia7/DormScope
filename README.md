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

1. **Institutions** — College Scorecard → `College` rows (`db:import-institutions`; CSV zip via `SCORECARD_ZIP_PATH` preferred).
2. **Official hall directories** — progressive seed of known residence halls (`db:seed-halls`).
3. **Scraper CLI** — Playwright/Cheerio against public housing pages with SSRF URL checks (`packages/scraper`). Run offline/CI workers, not on Vercel serverless.

Unknown attributes are stored/displayed as unknown — they are never treated as false.

## Tests

```bash
npm test --workspace=@dormscope/scoring
```

## Deploy (Vercel)

- Project: **dormscope** (`vercel.json` builds `@dormscope/web` after `db:generate`)
- Required env: `DATABASE_URL` (Neon), `ADMIN_API_KEY` (mutating admin/scraper routes)
- Set `NEXT_PUBLIC_API_URL` to **empty** so the app uses same-origin `/api` routes
- Do not rely on Vercel serverless for Playwright scraping

## Coverage (honest)

- **Institutions** come from College Scorecard (national higher-ed catalog).
- **Residence halls** are seeded and ingested progressively — not every college has hall-level data yet.
- **Unknown ≠ false**: lack of evidence does not mean a feature is absent.
- There is **no** claim of complete nationwide hall attribute coverage or fabricated “production-complete” dorm datasets. `db:seed` only loads catalog amenities (and an admin user), not fake dorms or reviews.

## Disclaimer

DormScope uses public sources. Data may be incomplete or outdated. Always verify with the university’s official housing office before deciding.

## License

MIT — portfolio / educational use.
