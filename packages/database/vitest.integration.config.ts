import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest config for Postgres integration tests.
 *
 * Required env:
 *   DATABASE_URL_TEST  — separate test database (recommended).
 *   ALLOW_TEST_ON_DEV_DB=1 — fallback to DATABASE_URL (local dev only).
 *
 * Run:
 *   npm run test:integration --workspace=@dormscope/database
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/integration/setup.ts"],
    // Sequential execution — tests share a real DB; avoid interleaved writes.
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
    sequence: {
      // Deterministic ordering so seed → tests run predictably.
      shuffle: false,
    },
    reporters: ["verbose"],
  },
  resolve: {
    alias: {
      "@dormscope/shared": path.resolve(__dirname, "../shared/src/index.ts"),
      "@dormscope/scoring": path.resolve(__dirname, "../scoring/src/index.ts"),
      "@dormscope/database": path.resolve(__dirname, "./src/index.ts"),
    },
  },
});
