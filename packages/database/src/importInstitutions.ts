import {
  HousingCoverageStatus,
  PrismaClient,
  Region,
  SchoolType,
  type College,
  type Prisma,
} from "@prisma/client";

const SCORECARD_ZIP_URL =
  "https://ed-public-download.scorecard.network/downloads/Most-Recent-Cohorts-Institution_06102026.zip";
const SCORECARD_API_BASE =
  "https://api.data.gov/ed/collegescorecard/v1/schools.json";
const API_FIELDS = [
  "id",
  "school.name",
  "school.alias",
  "school.city",
  "school.state",
  "school.school_url",
  "school.ownership",
  "school.operating",
  "location.lat",
  "location.lon",
  "school.locale",
  "latest.student.size",
].join(",");

const PER_PAGE = 100;
const LOG_EVERY = 100;
const PAGE_DELAY_MS = 800;
const MAX_RETRIES = 12;

export type InstitutionRecord = {
  ipedsUnitId: string | null;
  name: string;
  aliases: string[];
  city: string;
  state: string;
  websiteUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  schoolType: SchoolType;
  studentPopulation: number | null;
  operating: boolean;
};

export type ImportInstitutionsOptions = {
  prisma: PrismaClient;
  /**
   * `api` (default) — College Scorecard API with DEMO_KEY.
   * `csv` — Most-Recent-Cohorts zip (requires optional adm-zip).
   * `auto` — try CSV, fall back to API.
   */
  source?: "api" | "csv" | "auto";
  apiKey?: string;
  /** Cap pages for dry runs / tests. */
  maxPages?: number;
  /** Skip seedAliases after import. */
  skipSeedAliases?: boolean;
  onProgress?: (processed: number, totalHint?: number) => void;
};

export type ImportInstitutionsResult = {
  fetched: number;
  upserted: number;
  skippedClosed: number;
  skippedInvalid: number;
  aliasesCreated: number;
  seededAliases: number;
  source: "api" | "csv";
};

const STATE_REGION: Record<string, Region> = {
  CT: Region.NORTHEAST,
  ME: Region.NORTHEAST,
  MA: Region.NORTHEAST,
  NH: Region.NORTHEAST,
  NJ: Region.NORTHEAST,
  NY: Region.NORTHEAST,
  PA: Region.NORTHEAST,
  RI: Region.NORTHEAST,
  VT: Region.NORTHEAST,
  DE: Region.NORTHEAST,
  MD: Region.NORTHEAST,
  DC: Region.NORTHEAST,
  AL: Region.SOUTHEAST,
  AR: Region.SOUTHEAST,
  FL: Region.SOUTHEAST,
  GA: Region.SOUTHEAST,
  KY: Region.SOUTHEAST,
  LA: Region.SOUTHEAST,
  MS: Region.SOUTHEAST,
  NC: Region.SOUTHEAST,
  SC: Region.SOUTHEAST,
  TN: Region.SOUTHEAST,
  VA: Region.SOUTHEAST,
  WV: Region.SOUTHEAST,
  IL: Region.MIDWEST,
  IN: Region.MIDWEST,
  IA: Region.MIDWEST,
  KS: Region.MIDWEST,
  MI: Region.MIDWEST,
  MN: Region.MIDWEST,
  MO: Region.MIDWEST,
  NE: Region.MIDWEST,
  ND: Region.MIDWEST,
  OH: Region.MIDWEST,
  SD: Region.MIDWEST,
  WI: Region.MIDWEST,
  AZ: Region.SOUTHWEST,
  NM: Region.SOUTHWEST,
  OK: Region.SOUTHWEST,
  TX: Region.SOUTHWEST,
  CA: Region.WEST,
  HI: Region.WEST,
  NV: Region.WEST,
  AK: Region.NORTHWEST,
  ID: Region.NORTHWEST,
  MT: Region.NORTHWEST,
  OR: Region.NORTHWEST,
  UT: Region.WEST,
  WA: Region.NORTHWEST,
  WY: Region.NORTHWEST,
  CO: Region.WEST,
};

/** Manual short aliases for major schools (matched by name contains / exact). */
const MANUAL_ALIASES: Array<{ match: string | RegExp; aliases: string[] }> = [
  { match: /^University of California-Los Angeles$/i, aliases: ["UCLA"] },
  { match: /^University of Southern California$/i, aliases: ["USC"] },
  { match: /^Massachusetts Institute of Technology$/i, aliases: ["MIT"] },
  { match: /^New York University$/i, aliases: ["NYU"] },
  {
    match: /^Pennsylvania State University-Main Campus$/i,
    aliases: ["Penn State", "PSU"],
  },
  {
    match: /^University of Michigan-Ann Arbor$/i,
    aliases: ["UMich", "Michigan", "U of M"],
  },
  { match: /^Santa Clara University$/i, aliases: ["SCU"] },
  {
    match: /^The University of Texas at Austin$/i,
    aliases: ["UT Austin", "UT", "Texas"],
  },
  { match: /^Harvard University$/i, aliases: ["Harvard"] },
  { match: /^Stanford University$/i, aliases: ["Stanford"] },
  { match: /^Yale University$/i, aliases: ["Yale"] },
  { match: /^Princeton University$/i, aliases: ["Princeton"] },
  { match: /^Columbia University in the City of New York$/i, aliases: ["Columbia"] },
  { match: /^Cornell University$/i, aliases: ["Cornell"] },
  { match: /^Brown University$/i, aliases: ["Brown"] },
  { match: /^Dartmouth College$/i, aliases: ["Dartmouth"] },
  { match: /^Duke University$/i, aliases: ["Duke"] },
  { match: /^Northwestern University$/i, aliases: ["Northwestern", "NU"] },
  { match: /^University of Chicago$/i, aliases: ["UChicago", "Chicago"] },
  { match: /^University of California-Berkeley$/i, aliases: ["UC Berkeley", "Cal", "Berkeley"] },
  { match: /^University of California-San Diego$/i, aliases: ["UCSD"] },
  { match: /^University of California-Davis$/i, aliases: ["UC Davis", "UCD"] },
  { match: /^University of California-Irvine$/i, aliases: ["UCI", "UC Irvine"] },
  { match: /^University of California-Santa Barbara$/i, aliases: ["UCSB"] },
  { match: /^Georgia Institute of Technology-Main Campus$/i, aliases: ["Georgia Tech", "GT"] },
  { match: /^Carnegie Mellon University$/i, aliases: ["CMU"] },
  { match: /^University of Washington-Seattle Campus$/i, aliases: ["UW", "UDub"] },
  { match: /^University of Illinois Urbana-Champaign$/i, aliases: ["UIUC", "Illinois"] },
  { match: /^University of Wisconsin-Madison$/i, aliases: ["UW Madison", "Wisconsin"] },
  { match: /^Ohio State University-Main Campus$/i, aliases: ["Ohio State", "OSU"] },
  { match: /^University of Florida$/i, aliases: ["UF", "Florida"] },
  { match: /^Boston University$/i, aliases: ["BU"] },
  { match: /^University of Notre Dame$/i, aliases: ["Notre Dame", "ND"] },
  { match: /^Johns Hopkins University$/i, aliases: ["JHU", "Johns Hopkins"] },
];

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function ownershipToSchoolType(ownership: number | string | null | undefined): SchoolType {
  const n = typeof ownership === "string" ? Number(ownership) : ownership;
  // College Scorecard: 1=public, 2=private nonprofit, 3=private for-profit
  return n === 1 ? SchoolType.PUBLIC : SchoolType.PRIVATE;
}

export function regionForState(state: string): Region {
  return STATE_REGION[state.toUpperCase()] ?? Region.OTHER;
}

export function normalizeWebsiteUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function parseAliases(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,|]/)
    .map((a) => a.trim())
    .filter((a) => a.length > 0 && a.length <= 120);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapApiSchool(row: Record<string, unknown>): InstitutionRecord | null {
  const name = String(row["school.name"] ?? "").trim();
  if (!name) return null;

  const state = String(row["school.state"] ?? "").trim().toUpperCase();
  const city = String(row["school.city"] ?? "").trim() || "Unknown";
  if (!state) return null;

  const operatingRaw = row["school.operating"];
  const operating =
    operatingRaw === null || operatingRaw === undefined
      ? true
      : Number(operatingRaw) !== 0;

  const id = asNumber(row["id"]);

  return {
    ipedsUnitId: id !== null ? String(Math.trunc(id)) : null,
    name,
    aliases: parseAliases(
      row["school.alias"] === null || row["school.alias"] === undefined
        ? null
        : String(row["school.alias"])
    ),
    city,
    state,
    websiteUrl: normalizeWebsiteUrl(
      row["school.school_url"] === null || row["school.school_url"] === undefined
        ? null
        : String(row["school.school_url"])
    ),
    latitude: asNumber(row["location.lat"]),
    longitude: asNumber(row["location.lon"]),
    schoolType: ownershipToSchoolType(asNumber(row["school.ownership"])),
    studentPopulation: (() => {
      const size = asNumber(row["latest.student.size"]);
      return size !== null ? Math.trunc(size) : null;
    })(),
    operating,
  };
}

/** Minimal CSV line parser (handles quoted fields). */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function headerIndex(headers: string[], candidates: string[]): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const c of candidates) {
    const idx = lower.indexOf(c.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

export function mapCsvRow(
  headers: string[],
  values: string[]
): InstitutionRecord | null {
  const get = (candidates: string[]): string | null => {
    const idx = headerIndex(headers, candidates);
    if (idx < 0) return null;
    const v = values[idx]?.trim();
    return v && v !== "NULL" && v !== "PrivacySuppressed" ? v : null;
  };

  const name = get(["INSTNM", "instnm"]);
  if (!name) return null;

  const state = (get(["STABBR", "stabbr"]) ?? "").toUpperCase();
  const city = get(["CITY", "city"]) ?? "Unknown";
  if (!state) return null;

  const operatingRaw = get(["CURROPER", "curroper"]);
  const operating = operatingRaw === null ? true : operatingRaw !== "0";

  const unitId = get(["UNITID", "unitid"]);
  const ownership = get(["CONTROL", "control"]);

  return {
    ipedsUnitId: unitId,
    name,
    aliases: parseAliases(get(["ALIAS", "alias", "INSTALIAS"])),
    city,
    state,
    websiteUrl: normalizeWebsiteUrl(get(["INSTURL", "insturl"])),
    latitude: asNumber(get(["LATITUDE", "latitude"])),
    longitude: asNumber(get(["LONGITUDE", "longitude"])),
    schoolType: ownershipToSchoolType(ownership),
    studentPopulation: (() => {
      const size = asNumber(get(["UGDS", "ugds", "ENRTOT"]));
      return size !== null ? Math.trunc(size) : null;
    })(),
    operating,
  };
}

async function fetchJsonWithRetry(url: string): Promise<unknown> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(25_000) });
      if (res.status === 429 || res.status >= 500) {
        const backoff = PAGE_DELAY_MS * Math.pow(2, attempt + 1);
        console.warn(
          `Scorecard API ${res.status}; retrying in ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
        );
        await sleep(backoff);
        continue;
      }
      if (!res.ok) {
        throw new Error(`Scorecard API error ${res.status}: ${await res.text()}`);
      }
      return res.json();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const backoff = PAGE_DELAY_MS * Math.pow(2, attempt + 1);
      console.warn(
        `Scorecard fetch failed (${msg}); retrying in ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
      );
      await sleep(backoff);
    }
  }
  throw new Error("Scorecard API retries exhausted");
}

export async function* fetchInstitutionsFromApi(
  apiKey = "DEMO_KEY",
  maxPages?: number
): AsyncGenerator<{ record: InstitutionRecord; total?: number }, void, unknown> {
  let page = 0;
  let totalPages = Infinity;

  while (page < totalPages) {
    if (maxPages !== undefined && page >= maxPages) break;

    const url =
      `${SCORECARD_API_BASE}?api_key=${encodeURIComponent(apiKey)}` +
      `&fields=${API_FIELDS}&per_page=${PER_PAGE}&page=${page}`;

    const json = (await fetchJsonWithRetry(url)) as {
      metadata?: { total?: number; page?: number; per_page?: number };
      results?: Record<string, unknown>[];
    };

    const total = json.metadata?.total;
    if (typeof total === "number" && total > 0) {
      totalPages = Math.ceil(total / PER_PAGE);
    }

    const results = json.results ?? [];
    if (results.length === 0) break;

    console.log(
      `Fetched Scorecard page ${page + 1}/${Number.isFinite(totalPages) ? totalPages : "?"} (${results.length} rows)`
    );

    for (const row of results) {
      const record = mapApiSchool(row);
      if (record) yield { record, total };
    }

    page += 1;
    await sleep(PAGE_DELAY_MS);
  }
}

async function tryFetchInstitutionsFromCsv(): Promise<InstitutionRecord[] | null> {
  try {
    let buf: Buffer;
    const localPath = process.env.SCORECARD_ZIP_PATH;
    if (localPath) {
      const fs = await import("node:fs/promises");
      buf = await fs.readFile(localPath);
      console.log(`Loading Scorecard CSV from local zip: ${localPath}`);
    } else {
      const res = await fetch(SCORECARD_ZIP_URL, {
        signal: AbortSignal.timeout(180_000),
      });
      if (!res.ok) {
        console.warn(`CSV zip download failed: HTTP ${res.status}`);
        return null;
      }
      buf = Buffer.from(await res.arrayBuffer());
    }

    let AdmZip: new (buf: Buffer) => {
      getEntries: () => Array<{ entryName: string; getData: () => Buffer; isDirectory: boolean }>;
    };
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      AdmZip = require("adm-zip");
    } catch {
      console.warn("adm-zip not installed; falling back to College Scorecard API");
      return null;
    }

    const zip = new AdmZip(buf);
    const entry = zip
      .getEntries()
      .find((e) => !e.isDirectory && e.entryName.toLowerCase().endsWith(".csv"));
    if (!entry) {
      console.warn("No CSV found in Scorecard zip");
      return null;
    }

    const text = entry.getData().toString("utf8");
    const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
    if (lines.length < 2) return null;

    const headers = parseCsvLine(lines[0]);
    const records: InstitutionRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      const rec = mapCsvRow(headers, values);
      if (rec) records.push(rec);
    }
    return records;
  } catch (err) {
    console.warn("CSV download/parse failed; falling back to API:", err);
    return null;
  }
}

async function ensureUniqueSlug(
  prisma: PrismaClient,
  baseSlug: string,
  ipedsUnitId: string | null,
  excludeId?: string
): Promise<string> {
  let slug = baseSlug || (ipedsUnitId ? `institution-${ipedsUnitId}` : "institution");
  const exists = async (s: string) => {
    const found = await prisma.college.findUnique({ where: { slug: s } });
    return found && found.id !== excludeId ? true : false;
  };

  if (!(await exists(slug))) return slug;

  if (ipedsUnitId) {
    const withId = `${slug}-${ipedsUnitId}`;
    if (!(await exists(withId))) return withId;
  }

  let n = 2;
  while (await exists(`${slug}-${n}`)) n += 1;
  return `${slug}-${n}`;
}

async function upsertInstitution(
  prisma: PrismaClient,
  rec: InstitutionRecord
): Promise<{ college: College; createdAliases: number }> {
  const baseSlug = slugify(rec.name);
  const shortName = rec.aliases[0]?.slice(0, 64) ?? null;

  const data: Prisma.CollegeCreateInput = {
    name: rec.name,
    slug: baseSlug,
    shortName,
    city: rec.city,
    state: rec.state,
    region: regionForState(rec.state),
    schoolType: rec.schoolType,
    websiteUrl: rec.websiteUrl,
    studentPopulation: rec.studentPopulation,
    latitude: rec.latitude,
    longitude: rec.longitude,
    ipedsUnitId: rec.ipedsUnitId,
    countryCode: "US",
    hasResidentialHousing: null,
    housingCoverageStatus: HousingCoverageStatus.DISCOVERY_PENDING,
    lastUpdatedAt: new Date(),
  };

  const updateData: Prisma.CollegeUpdateInput = {
    name: rec.name,
    shortName,
    city: rec.city,
    state: rec.state,
    region: regionForState(rec.state),
    schoolType: rec.schoolType,
    websiteUrl: rec.websiteUrl,
    studentPopulation: rec.studentPopulation,
    latitude: rec.latitude,
    longitude: rec.longitude,
    countryCode: "US",
    // Do not overwrite housing fields or coverage once set by scrapers
    lastUpdatedAt: new Date(),
    ...(rec.ipedsUnitId ? { ipedsUnitId: rec.ipedsUnitId } : {}),
  };

  let college: College | null = null;

  if (rec.ipedsUnitId) {
    college = await prisma.college.findUnique({
      where: { ipedsUnitId: rec.ipedsUnitId },
    });
  }
  if (!college) {
    college = await prisma.college.findUnique({ where: { slug: baseSlug } });
    // If slug matches a different IPEDS id, treat as collision → new slug
    if (college?.ipedsUnitId && rec.ipedsUnitId && college.ipedsUnitId !== rec.ipedsUnitId) {
      college = null;
    }
  }

  if (college) {
    college = await prisma.college.update({
      where: { id: college.id },
      data: updateData,
    });
  } else {
    const slug = await ensureUniqueSlug(prisma, baseSlug, rec.ipedsUnitId);
    college = await prisma.college.create({
      data: { ...data, slug },
    });
  }

  let createdAliases = 0;
  for (const alias of rec.aliases) {
    try {
      const existing = await prisma.collegeAlias.findUnique({
        where: {
          collegeId_alias: { collegeId: college.id, alias },
        },
      });
      if (existing) continue;
      await prisma.collegeAlias.create({
        data: { collegeId: college.id, alias },
      });
      createdAliases += 1;
    } catch {
      // Model missing or constraint — shortName already set; skip gracefully
    }
  }

  return { college, createdAliases };
}

export async function seedAliases(prisma: PrismaClient): Promise<number> {
  const colleges = await prisma.college.findMany({
    select: { id: true, name: true, shortName: true },
  });

  let seeded = 0;

  for (const entry of MANUAL_ALIASES) {
    const matched = colleges.filter((c) =>
      typeof entry.match === "string"
        ? c.name.toLowerCase() === entry.match.toLowerCase()
        : entry.match.test(c.name)
    );

    for (const college of matched) {
      if (!college.shortName && entry.aliases[0]) {
        await prisma.college.update({
          where: { id: college.id },
          data: { shortName: entry.aliases[0] },
        });
        college.shortName = entry.aliases[0];
      }

      for (const alias of entry.aliases) {
        try {
          const existing = await prisma.collegeAlias.findUnique({
            where: {
              collegeId_alias: { collegeId: college.id, alias },
            },
          });
          if (existing) continue;

          await prisma.collegeAlias.create({
            data: { collegeId: college.id, alias },
          });
          seeded += 1;
        } catch {
          // graceful if alias table unavailable
        }
      }
    }
  }

  return seeded;
}

export async function importInstitutions(
  options: ImportInstitutionsOptions
): Promise<ImportInstitutionsResult> {
  const {
    prisma,
    source = "api",
    apiKey = process.env.COLLEGE_SCORECARD_API_KEY ?? "DEMO_KEY",
    maxPages,
    skipSeedAliases = false,
    onProgress,
  } = options;

  let usedSource: "api" | "csv" = "api";
  let fetched = 0;
  let upserted = 0;
  let skippedClosed = 0;
  let skippedInvalid = 0;
  let aliasesCreated = 0;

  const processRecord = async (rec: InstitutionRecord) => {
    fetched += 1;
    if (!rec.operating) {
      skippedClosed += 1;
      return;
    }
    if (!rec.name || !rec.state) {
      skippedInvalid += 1;
      return;
    }

    const { createdAliases } = await upsertInstitution(prisma, rec);
    upserted += 1;
    aliasesCreated += createdAliases;

    if (fetched % LOG_EVERY === 0) {
      console.log(
        `Progress: processed=${fetched} upserted=${upserted} skippedClosed=${skippedClosed}`
      );
      onProgress?.(fetched);
    }
  };

  if (source === "csv" || source === "auto") {
    const csvRecords = await tryFetchInstitutionsFromCsv();
    if (csvRecords && csvRecords.length > 0) {
      usedSource = "csv";
      console.log(`Loaded ${csvRecords.length} institutions from Scorecard CSV zip`);
      for (const rec of csvRecords) {
        await processRecord(rec);
      }
    } else if (source === "csv") {
      throw new Error("CSV source requested but download/parse failed");
    }
  }

  if (usedSource !== "csv") {
    usedSource = "api";
    console.log(`Fetching institutions from College Scorecard API (key=${apiKey === "DEMO_KEY" ? "DEMO_KEY" : "custom"})…`);
    for await (const { record, total } of fetchInstitutionsFromApi(apiKey, maxPages)) {
      await processRecord(record);
      if (fetched % LOG_EVERY === 0 && total) {
        onProgress?.(fetched, total);
      }
    }
  }

  let seededAliases = 0;
  if (!skipSeedAliases) {
    console.log("Seeding common aliases for major schools…");
    seededAliases = await seedAliases(prisma);
  }

  console.log(
    `Import complete via ${usedSource}: fetched=${fetched} upserted=${upserted} skippedClosed=${skippedClosed} skippedInvalid=${skippedInvalid} aliases=${aliasesCreated} seededAliases=${seededAliases}`
  );

  return {
    fetched,
    upserted,
    skippedClosed,
    skippedInvalid,
    aliasesCreated,
    seededAliases,
    source: usedSource,
  };
}
