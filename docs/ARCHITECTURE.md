# DormScope Architecture

## Data flow

1. **Discovery** — Generate housing-related search queries per college; prioritize `.edu` domains.
2. **Scrape** — Playwright fetches pages; Cheerio extracts dorm names, amenities, costs.
3. **Normalize** — Map synonyms (res hall → residence_hall, A/C → ac) in `@dormscope/shared`.
4. **Score** — `@dormscope/scoring` computes DormScope Score and stores in `DormScore`.
5. **Serve** — Express API exposes search, analytics, admin; Next.js renders product UI.

## Deployment

- **apps/web** → Vercel  
- **apps/api** → Railway or Render  
- **PostgreSQL** → Supabase or managed Postgres  
- **Redis** → Upstash (optional, for BullMQ)  

## Auth

Clerk keys are optional. Guest users use `localStorage` for favorites and compare lists until Clerk is configured.
