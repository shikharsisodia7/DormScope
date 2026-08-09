import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { status: 200, ...init });
}

export function jsonError(message: string, status = 400, details?: unknown) {
  const body: { error: string; details?: unknown } = { error: message };
  if (details !== undefined && process.env.NODE_ENV !== "production") {
    body.details = details;
  }
  return NextResponse.json(body, { status });
}

export function handleRouteError(err: unknown) {
  if (err instanceof ZodError) {
    return jsonError("Validation failed", 400, err.flatten());
  }
  const message = err instanceof Error ? err.message : "Internal server error";
  // Never leak stack traces to clients
  console.error("[api]", message);
  return jsonError(
    process.env.NODE_ENV === "production" ? "Internal server error" : message,
    500
  );
}

export function parsePagination(searchParams: URLSearchParams, defaults?: { page?: number; pageSize?: number }) {
  const page = Math.max(1, Number(searchParams.get("page") ?? defaults?.page ?? 1) || 1);
  const rawSize = Number(searchParams.get("pageSize") ?? defaults?.pageSize ?? 24) || 24;
  const pageSize = Math.min(100, Math.max(1, rawSize));
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip };
}

export function normalizeSearchQuery(q: string): string {
  return q
    .trim()
    .toLowerCase()
    .replace(/[^\w\s&'-]/g, " ")
    .replace(/\s+/g, " ");
}

/** Simple in-memory rate limiter (per serverless instance). */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function requireAdminKey(req: Request): boolean {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) return false;
  const header = req.headers.get("x-admin-key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return header === expected;
}

export function randomShareToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}
