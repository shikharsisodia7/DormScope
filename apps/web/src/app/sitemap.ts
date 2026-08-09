import type { MetadataRoute } from "next";
import { fetchApi } from "@/lib/utils";

interface CollegeItem {
  slug: string;
  updatedAt?: string;
}

interface DormItem {
  slug: string;
  college?: { slug: string };
  collegeSlug?: string;
  updatedAt?: string;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://dormscope.app";
  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/colleges",
    "/match",
    "/compare",
    "/saved",
    "/about",
    "/privacy",
    "/terms",
    "/guidelines",
    "/how-rankings-work",
    "/community",
  ].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));

  let collegeRoutes: MetadataRoute.Sitemap = [];
  let dormRoutes: MetadataRoute.Sitemap = [];

  try {
    const data = await fetchApi<{ items?: CollegeItem[]; colleges?: CollegeItem[] } | CollegeItem[]>(
      "/api/colleges?pageSize=100",
      { cache: "no-store" }
    );
    const colleges = Array.isArray(data) ? data : data.items ?? data.colleges ?? [];
    collegeRoutes = colleges.map((c) => ({
      url: `${base}/colleges/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    /* omit dynamic college URLs if API unavailable at build */
  }

  try {
    const data = await fetchApi<{ items?: DormItem[]; dorms?: DormItem[] } | DormItem[]>(
      "/api/dorms/search?pageSize=100",
      { cache: "no-store" }
    );
    const dorms = Array.isArray(data) ? data : data.items ?? data.dorms ?? [];
    dormRoutes = dorms
      .map((d) => {
        const collegeSlug = d.college?.slug ?? d.collegeSlug;
        if (!collegeSlug || !d.slug) return null;
        return {
          url: `${base}/colleges/${collegeSlug}/dorms/${d.slug}`,
          changeFrequency: "weekly" as const,
          priority: 0.6,
        };
      })
      .filter(Boolean) as MetadataRoute.Sitemap;
  } catch {
    /* omit */
  }

  return [...staticRoutes, ...collegeRoutes, ...dormRoutes];
}
