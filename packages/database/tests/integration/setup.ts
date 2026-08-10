/**
 * Integration test bootstrap — runs in each vitest worker BEFORE any test
 * module is loaded, so PrismaClient picks up the correct DATABASE_URL.
 *
 * Guard rails:
 *   - DATABASE_URL_TEST set → use it as DATABASE_URL.
 *   - DATABASE_URL_TEST unset + ALLOW_TEST_ON_DEV_DB=1 → proceed with
 *     DATABASE_URL (local dev only — dangerous in CI).
 *   - Otherwise → throw so integration tests never silently run against the
 *     development database.
 */

const testUrl = process.env.DATABASE_URL_TEST;
const allowFallback = process.env.ALLOW_TEST_ON_DEV_DB === "1";

if (!testUrl && !allowFallback) {
  throw new Error(
    [
      "",
      "┌─────────────────────────────────────────────────────────┐",
      "│  Integration tests require DATABASE_URL_TEST to be set. │",
      "│                                                         │",
      "│  Option A (recommended):                                │",
      "│    DATABASE_URL_TEST=postgresql://... npm run           │",
      "│    test:integration --workspace=@dormscope/database     │",
      "│                                                         │",
      "│  Option B (local dev, DANGEROUS):                       │",
      "│    ALLOW_TEST_ON_DEV_DB=1 npm run test:integration      │",
      "│    --workspace=@dormscope/database                      │",
      "└─────────────────────────────────────────────────────────┘",
      "",
    ].join("\n")
  );
}

if (testUrl) {
  process.env.DATABASE_URL = testUrl;
}
