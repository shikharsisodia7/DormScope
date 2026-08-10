import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@prisma/client";
export {
  importInstitutions,
  seedAliases,
  slugify,
  ownershipToSchoolType,
  regionForState,
  parseAliases,
  normalizeWebsiteUrl,
  type InstitutionRecord,
  type ImportInstitutionsOptions,
  type ImportInstitutionsResult,
} from "./importInstitutions";

// Integration helpers live in ./integration/* and are imported directly by
// tests/scripts — do not re-export here (breaks Next.js package resolution).
