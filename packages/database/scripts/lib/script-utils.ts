import { PrismaClient } from "@prisma/client";

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }
  return url;
}

export function createScriptPrisma(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: requireDatabaseUrl() } },
  });
}

export function isApplyMode(): boolean {
  return process.env.APPLY === "1" || process.env.APPLY === "true";
}

export function printModeBanner(apply: boolean): void {
  console.log(apply ? "=== APPLY MODE (writing changes) ===" : "=== DRY RUN (no writes; set APPLY=1 to apply) ===");
}
