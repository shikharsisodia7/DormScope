import * as cheerio from "cheerio";
import { normalizeAC, normalizeBathroom, parsePrice } from "@dormscope/shared";

export interface ExtractedDorm {
  name: string;
  description?: string;
  amenities: string[];
  costs: { label: string; amount: number; period: string; uncertain: boolean }[];
  imageUrl?: string;
  links: string[];
}

export function parseHousingHtml(html: string, baseUrl: string): ExtractedDorm[] {
  const $ = cheerio.load(html);
  const dorms: ExtractedDorm[] = [];
  const seen = new Set<string>();

  $("h2, h3, h4, .building-name, .hall-name, [class*='residence'], [class*='dorm']").each((_, el) => {
    const name = $(el).text().trim();
    if (name.length < 3 || name.length > 80 || seen.has(name.toLowerCase())) return;
    if (!/hall|house|quad|tower|villa|residence|dorm|living/i.test(name)) return;

    seen.add(name.toLowerCase());
    const section = $(el).parent();
    const text = section.text();
    const amenities: string[] = [];
    if (normalizeAC(text)) amenities.push("ac");
    if (/laundry/i.test(text)) amenities.push("laundry");
    if (/kitchen/i.test(text)) amenities.push("kitchen");
    if (/study lounge/i.test(text)) amenities.push("study_lounge");

    const costs: ExtractedDorm["costs"] = [];
    const priceMatches = text.match(/\$[\d,]+(?:\.\d{2})?[^.]{0,40}/g) ?? [];
    for (const pm of priceMatches.slice(0, 3)) {
      const parsed = parsePrice(pm);
      if (parsed) costs.push({ label: "Housing cost", amount: parsed.amount, period: parsed.period, uncertain: parsed.uncertain });
    }

    const links: string[] = [];
    section.find("a[href]").each((__, a) => {
      const href = $(a).attr("href");
      if (href) {
        try {
          links.push(new URL(href, baseUrl).toString());
        } catch {
          /* ignore */
        }
      }
    });

    let imageUrl: string | undefined;
    const img = section.find("img").first().attr("src");
    if (img) {
      try {
        imageUrl = new URL(img, baseUrl).toString();
      } catch {
        /* ignore */
      }
    }

    dorms.push({
      name,
      description: text.slice(0, 500),
      amenities,
      costs,
      imageUrl,
      links,
    });
  });

  return dorms.slice(0, 50);
}

export function parsePageMetadata(html: string): { title: string; links: string[] } {
  const $ = cheerio.load(html);
  const title = $("title").text().trim();
  const links: string[] = [];
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href");
    if (href && /housing|residence|dorm|room|board|rates/i.test(href + $(a).text())) {
      links.push(href);
    }
  });
  return { title, links: Array.from(new Set(links)).slice(0, 30) };
}

export { normalizeBathroom };
