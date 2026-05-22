# DormScope

**Nationwide college dorm intelligence** — search, score, map, compare, and recommend on-campus housing across the United States.

Built as a full-stack data platform (not a Python dashboard): Next.js frontend, Express API, PostgreSQL + Prisma, Playwright scraper, scoring engine, and admin tooling.

## Tech stack

| Layer | Technology |
|--------|------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn-style UI |
| Backend API | Express (Node.js) |
| Database | PostgreSQL + Prisma |
| Scraper | Playwright + Cheerio |
| Maps | Leaflet / react-leaflet |
| Charts | Recharts |
| Auth | Clerk-ready (guest favorites via localStorage) |
| Jobs | BullMQ + Redis (optional) |
| AI | Rule-based summaries + optional OpenAI |
| Deploy | Vercel (web) + Railway/Render (API) + Supabase/Postgres |

## Features

- Homepage with national stats and college/dorm search
- College housing overview with charts and highlights
- Dorm profile pages with DormScope Score breakdown
- Side-by-side comparison (2–4 dorms) + CSV export
- Dorm-fit recommendation quiz (weighted scoring)
- National analytics dashboard
- Interactive U.S. college map
- Saved dorms (guest + user-ready)
- Admin + scraper + data quality dashboards
- Public-data-only scraper pipeline with confidence scores

## Project structure

```txt
dormscope/
  apps/
    web/          # Next.js frontend
    api/          # Express REST API
  packages/
    database/     # Prisma schema + seed
    scraper/      # Playwright discovery & extraction
    scoring/      # DormScore + recommendations + summaries
    shared/       # Types, normalization, badges
  docs/
  README.md
```

## Quick start

### Prerequisites

- Node.js 20+
- PostgreSQL (local, Docker, or Supabase)
- Optional: Redis for BullMQ background jobs

### 1. Install dependencies

```bash
cd "Dorm Project"
npm install
```

### 2. Environment

```bash
cp .env.example .env
# Edit DATABASE_URL and other variables
```

### 3. Database

```bash
npm run db:push
npm run db:seed
```

### 4. Run services

Terminal 1 — API:

```bash
npm run dev:api
```

Terminal 2 — Web:

```bash
npm run dev:web
```

- Web: http://localhost:3000  
- API: http://localhost:4000  

### 5. Scraper (optional)

```bash
npm run scraper -- santa-clara-university
```

## Environment variables

See [.env.example](.env.example) for full list. Key variables:

- `DATABASE_URL` — PostgreSQL connection string
- `NEXT_PUBLIC_API_URL` — API base URL for the frontend
- `CLERK_*` — Optional authentication
- `OPENAI_API_KEY` — Optional AI summaries
- `REDIS_URL` — Optional job queue

## Database schema

Core models: `College`, `Dorm`, `RoomType`, `Amenity`, `DormAmenity`, `HousingCost`, `Source`, `ReviewSummary`, `DormScore`, `ScrapeJob`, `ScrapeLog`, `User`, `FavoriteDorm`, `ComparisonList`, `RecommendationProfile`, `DataQualityReport`.

See [packages/database/prisma/schema.prisma](packages/database/prisma/schema.prisma).

## DormScope Score (0–100)

Weighted combination of:

- Value, Comfort, Privacy, Social, Convenience, Freshman fit, Amenity, Data confidence

Implementation: [packages/scoring/src/dormScore.ts](packages/scoring/src/dormScore.ts)

## Data confidence

- Official university pages → high confidence  
- Student forums → lower confidence  
- Missing/ambiguous fields → Unknown / Needs verification  
- No guessing on unclear prices ([packages/shared/src/utils/normalize.ts](packages/shared/src/utils/normalize.ts))

## Scraper

- Discovery queries: `[college] housing`, `residence halls`, `housing rates`, etc.
- Playwright for dynamic pages, Cheerio for HTML parsing
- Only public URLs; respects rate limits
- Admin dashboard to run jobs, approve sources, verify dorms

## Seed data

Demo seed includes **Santa Clara University**, Michigan, UT Austin, Boston University, and Florida with realistic dorms, scores, and amenities. Architecture supports scaling to all U.S. colleges.

## Roadmap

- [ ] Clerk auth + persistent favorites
- [ ] BullMQ scheduled scrape jobs
- [ ] Mapbox campus-level dorm pins
- [ ] PDF housing rate parser
- [ ] Full U.S. college index import
- [ ] Supabase Storage for dorm images

## Disclaimer

DormScope uses **public sources only**. Data may be incomplete or outdated. Always verify with your university's official housing office before making housing decisions.

## Screenshots

_Add screenshots after running the app locally._

## License

MIT — portfolio / educational use.
