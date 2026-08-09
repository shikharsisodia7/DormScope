# DormScope Web

Next.js 14 app for DormScope — college dorm search, personalized match rankings, compare, and reviews.

## Develop

From the monorepo root (or this package):

```bash
npm run dev --workspace=@dormscope/web
```

App: [http://localhost:3000](http://localhost:3000)

API routes live under `src/app/api/*` and talk to Prisma via `@dormscope/database`.

## Key routes

- `/` — brand-first home + college search
- `/match` — Find My Best Dorm flow (`/quiz` redirects here)
- `/colleges`, `/colleges/[slug]`, dorm detail pages
- `/compare`, `/saved`
- Legal: `/privacy`, `/terms`, `/guidelines`, `/how-rankings-work`, `/community`
- `/admin` — admin only (not in public nav)

## Design

Fraunces + DM Sans, warm stone canvas, forest teal primary. Tokens in `src/app/globals.css`.
