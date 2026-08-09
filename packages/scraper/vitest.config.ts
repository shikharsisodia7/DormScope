import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@dormscope/shared": path.resolve(__dirname, "../shared/src/index.ts"),
      "@dormscope/database": path.resolve(__dirname, "../database/src/index.ts"),
      "@dormscope/scoring": path.resolve(__dirname, "../scoring/src/index.ts"),
    },
  },
});
