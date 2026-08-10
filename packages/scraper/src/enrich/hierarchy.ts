/**
 * Hierarchy enrichment: link child housing entities to parents
 * when official source structure provides strong evidence.
 * Never invent relationships.
 */
import { prisma, HousingEntityKind, DataQualityStatus } from "@dormscope/database";
import { safeSameEntity } from "../ingest/entityResolution.js";

export interface HierarchySuggestion {
  childId: string;
  parentId: string;
  confidence: number;
  reasons: string[];
  autoLink: boolean;
}

const PARENT_KINDS = new Set<HousingEntityKind>([
  HousingEntityKind.COMPLEX,
  HousingEntityKind.VILLAGE,
  HousingEntityKind.RESIDENTIAL_COLLEGE,
  HousingEntityKind.UNIT,
  HousingEntityKind.APARTMENT_COMMUNITY,
]);

const CHILD_KINDS = new Set<HousingEntityKind>([
  HousingEntityKind.BUILDING,
  HousingEntityKind.HOUSE,
  HousingEntityKind.RESIDENCE,
  HousingEntityKind.OTHER,
  HousingEntityKind.UNKNOWN,
]);

/**
 * Infer parent/child suggestions for one college from names, kinds, and hints.
 */
export function suggestHierarchy(
  dorms: Array<{
    id: string;
    name: string;
    entityKind: HousingEntityKind;
    parentHousingId: string | null;
    officialCategoryLabel?: string | null;
    description?: string | null;
  }>
): HierarchySuggestion[] {
  const suggestions: HierarchySuggestion[] = [];
  const parents = dorms.filter((d) => PARENT_KINDS.has(d.entityKind) || /village|complex|unit\s*\d|college|community/i.test(d.name));
  const children = dorms.filter((d) => !d.parentHousingId);

  for (const child of children) {
    // Phrase: "part of X", "located in X", "within X"
    const desc = `${child.description ?? ""} ${child.officialCategoryLabel ?? ""}`;
    const partOf = desc.match(/\b(?:part of|located in|within|buildings? (?:in|of)|houses? (?:in|of))\s+([A-Z][A-Za-z0-9 .'&\-]{2,60})/i);
    if (partOf) {
      const hint = partOf[1].trim();
      const parent = parents.find((p) => p.id !== child.id && (safeSameEntity(p.name, hint) || p.name.toLowerCase().includes(hint.toLowerCase()) || hint.toLowerCase().includes(p.name.toLowerCase())));
      if (parent) {
        suggestions.push({
          childId: child.id,
          parentId: parent.id,
          confidence: 0.85,
          reasons: ["phrase_part_of_evidence"],
          autoLink: true,
        });
        continue;
      }
    }

    // Category label matches a parent name
    if (child.officialCategoryLabel) {
      const label = child.officialCategoryLabel.trim();
      const parent = parents.find(
        (p) =>
          p.id !== child.id &&
          (safeSameEntity(p.name, label) ||
            p.name.toLowerCase() === label.toLowerCase() ||
            label.toLowerCase().includes(p.name.toLowerCase()))
      );
      if (parent && CHILD_KINDS.has(child.entityKind)) {
        suggestions.push({
          childId: child.id,
          parentId: parent.id,
          confidence: 0.75,
          reasons: ["official_category_label"],
          autoLink: confidenceHigh(0.75),
        });
        continue;
      }
    }

    // Name nesting: "South Campus Unit 1" under "Unit 1"; "Unit 1 (Christian Hall)" already unit
    for (const parent of parents) {
      if (parent.id === child.id) continue;
      const pn = parent.name.toLowerCase();
      const cn = child.name.toLowerCase();
      if (cn === pn) continue;

      // Child name contains parent name as a token phrase
      if (cn.includes(pn) && cn.length > pn.length + 2 && PARENT_KINDS.has(parent.entityKind)) {
        const conf = parent.entityKind === HousingEntityKind.UNIT ? 0.8 : 0.7;
        suggestions.push({
          childId: child.id,
          parentId: parent.id,
          confidence: conf,
          reasons: ["name_contains_parent"],
          autoLink: conf >= 0.8,
        });
        break;
      }

      // Unit N buildings: "Christian Hall" under Unit 1 via description mentioning Unit 1
      if (/unit\s*\d/i.test(parent.name) && /\bunit\s*\d/i.test(desc) && safeUnitMatch(parent.name, desc)) {
        suggestions.push({
          childId: child.id,
          parentId: parent.id,
          confidence: 0.78,
          reasons: ["unit_description_link"],
          autoLink: true,
        });
        break;
      }
    }
  }

  // Deduplicate: one parent per child (highest confidence)
  const best = new Map<string, HierarchySuggestion>();
  for (const s of suggestions) {
    const prev = best.get(s.childId);
    if (!prev || s.confidence > prev.confidence) best.set(s.childId, s);
  }
  return Array.from(best.values());
}

function confidenceHigh(c: number) {
  return c >= 0.8;
}

function safeUnitMatch(parentName: string, text: string): boolean {
  const m = parentName.match(/unit\s*(\d+)/i);
  if (!m) return false;
  const re = new RegExp(`\\bunit\\s*${m[1]}\\b`, "i");
  // Ensure we don't match Unit 10 when looking for Unit 1
  const bad = new RegExp(`\\bunit\\s*${m[1]}\\d`, "i");
  return re.test(text) && !bad.test(text.replace(re, ""));
}

/**
 * Apply high-confidence hierarchy links for a college.
 * Medium confidence → ExtractionDecision metadata / DataQualityReport style note via return.
 */
export async function enrichCollegeHierarchy(
  collegeId: string,
  opts?: { applyMedium?: boolean }
): Promise<{ linked: number; suggested: number; suggestions: HierarchySuggestion[] }> {
  const dorms = await prisma.dorm.findMany({
    where: {
      collegeId,
      isActive: true,
      dataQualityStatus: { notIn: [DataQualityStatus.QUARANTINED, DataQualityStatus.DUPLICATE, DataQualityStatus.RETIRED] },
    },
    select: {
      id: true,
      name: true,
      entityKind: true,
      parentHousingId: true,
      officialCategoryLabel: true,
      description: true,
    },
  });

  const suggestions = suggestHierarchy(dorms);
  let linked = 0;

  for (const s of suggestions) {
    const apply = s.autoLink || (opts?.applyMedium && s.confidence >= 0.7);
    if (!apply) continue;

    // Don't create cycles
    if (s.childId === s.parentId) continue;
    const parent = dorms.find((d) => d.id === s.parentId);
    if (parent?.parentHousingId === s.childId) continue;

    await prisma.dorm.update({
      where: { id: s.childId },
      data: { parentHousingId: s.parentId },
    });

    // Organizational parent: demote pure complexes/villages/residential colleges from Match
    if (
      parent &&
      (parent.entityKind === HousingEntityKind.COMPLEX ||
        parent.entityKind === HousingEntityKind.VILLAGE ||
        parent.entityKind === HousingEntityKind.RESIDENTIAL_COLLEGE)
    ) {
      await prisma.dorm.update({
        where: { id: s.parentId },
        data: {
          isAssignableHousingOption: false,
          rankingGranularity: false,
        },
      });
    }

    // Provenance for hierarchy
    await prisma.fieldProvenance.create({
      data: {
        dormId: s.childId,
        fieldName: "parentHousingId",
        valueSnapshot: s.parentId,
        confidence: s.confidence,
        verified: false,
        sourceUrl: null,
      },
    }).catch(() => undefined);

    linked += 1;
  }

  return { linked, suggested: suggestions.length, suggestions };
}

export async function enrichAllHierarchy(opts?: {
  collegeSlugs?: string[];
  applyMedium?: boolean;
}): Promise<Array<{ slug: string; linked: number; suggested: number }>> {
  const where = opts?.collegeSlugs?.length
    ? { slug: { in: opts.collegeSlugs } }
    : { dorms: { some: { isActive: true } } };

  const colleges = await prisma.college.findMany({
    where,
    select: { id: true, slug: true },
    orderBy: { slug: "asc" },
  });

  const out: Array<{ slug: string; linked: number; suggested: number }> = [];
  for (const c of colleges) {
    const r = await enrichCollegeHierarchy(c.id, { applyMedium: opts?.applyMedium });
    out.push({ slug: c.slug, linked: r.linked, suggested: r.suggested });
  }
  return out;
}
