import type { PrismaClient } from "@prisma/client";
import { assessHousingName, type JunkCandidate } from "./junk-housing";

/**
 * Find junk candidates by name patterns.
 * High-confidence junk names are flagged even when a Source/DormSource exists
 * (nav/FAQ pages often still create a source row).
 */
export async function findJunkCandidates(prisma: PrismaClient): Promise<JunkCandidate[]> {
  const dorms = await prisma.dorm.findMany({
    where: {
      isVerified: false,
      dataQualityStatus: { notIn: ["QUARANTINED", "RETIRED", "DUPLICATE"] },
    },
    select: {
      id: true,
      name: true,
      collegeId: true,
      college: { select: { name: true, slug: true } },
      dormSources: { select: { id: true }, take: 1 },
      sources: { where: { isApproved: true }, select: { id: true }, take: 1 },
      reviews: { select: { id: true }, take: 1 },
      favorites: { select: { id: true }, take: 1 },
    },
  });

  const candidates: JunkCandidate[] = [];
  for (const d of dorms) {
    const assessment = assessHousingName(d.name);
    if (!assessment.isJunk || !assessment.reason) continue;

    // Soften: if entity has user data, only quarantine the strongest junk reasons
    const hasUserData = d.reviews.length > 0 || d.favorites.length > 0;
    if (hasUserData && !["nav_or_policy_label", "procedural_title", "cta_phrase"].includes(assessment.reason)) {
      continue;
    }

    candidates.push({
      id: d.id,
      name: d.name,
      collegeId: d.collegeId,
      collegeName: d.college.name,
      collegeSlug: d.college.slug,
      reason: assessment.reason,
    });
  }
  return candidates;
}
