# DormScope Architecture

## Runtime

- **Production:** Next.js on Vercel (`apps/web`) — UI + `/api/*` route handlers, Prisma → Neon Postgres.
- **Optional:** Express (`apps/api`) for local or split deployments when `NEXT_PUBLIC_API_URL` points at it.
- **Scraper:** CLI in `@dormscope/scraper` (Playwright + Cheerio + SSRF checks). Not deployed as Vercel serverless.

## Data flow

1. **Institutions** — College Scorecard import (`db:import-institutions`; prefer `SCORECARD_ZIP_PATH` CSV zip).
2. **Hall directories** — Official residence-hall seed (`db:seed-halls`), then progressive scraper ingestion.
3. **Normalize** — Synonyms / field mapping in `@dormscope/shared`.
4. **Rank** — `@dormscope/scoring` preference registry: hard filters → soft match score; confidence tracked separately; `algorithmVersion` on results.
5. **Serve** — Next.js `/api` (default) or Express; product UI in `apps/web`.

## Ranking principles

- Soft weights score fit; hard constraints exclude only on positive contrary evidence.
- Missing evidence → unknown (eligible for hard checks; lowers confidence).
- Match score and confidence are independent signals.

## Deploy

| Piece | Where |
|--------|--------|
| Web + API routes | Vercel project **dormscope** |
| Postgres | Neon (`DATABASE_URL`) |
| Admin mutations | `ADMIN_API_KEY` |
| Same-origin API | `NEXT_PUBLIC_API_URL=""` |
| Scraper / Redis jobs | Separate worker / local CLI (optional Redis/BullMQ) |

## Auth

Clerk keys optional. Guests use `localStorage` for favorites and compare lists until Clerk is configured.
