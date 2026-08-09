import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Prefer same-origin `/api` when NEXT_PUBLIC_API_URL is unset. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

function resolveApiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (API_URL) return `${API_URL.replace(/\/$/, "")}${normalized}`;
  if (typeof window === "undefined") {
    const vercel = process.env.VERCEL_URL;
    if (vercel) return `https://${vercel}${normalized}`;
    const port = process.env.PORT ?? "3000";
    return `http://localhost:${port}${normalized}`;
  }
  return normalized;
}

export async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const url = resolveApiUrl(path);
  const noStore = init?.cache === "no-store";
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...(noStore ? { cache: "no-store" as const } : { next: { revalidate: 60 } }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

/** Display helper: null/undefined → Unknown; false → No; true → Yes */
export function factLabel(value: boolean | null | undefined): string {
  if (value == null) return "Unknown";
  return value ? "Yes" : "No";
}

export function moneyOrUnknown(value: number | null | undefined, suffix = "/yr"): string {
  if (value == null || Number.isNaN(value)) return "Unknown";
  return `$${value.toLocaleString()}${suffix}`;
}
