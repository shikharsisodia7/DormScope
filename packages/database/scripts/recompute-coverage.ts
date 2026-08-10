/**
 * Downgrade COMPLETE colleges that lack directory-exhaustion evidence.
 * Never keep COMPLETE merely because entity count >= 8.
 * Legacy COMPLETE from the old dormsFound>=8 scraper is not trusted.
 *
 * APPLY=1 to write.
 */
import { HousingCoverageStatus } from "@prisma/client";
import { createScriptPrisma, isApplyMode, printModeBanner } from "./lib/script-utils";

interface CoverageEvidence {
  hasOfficialDirectoryPageRole: boolean;
  checkpointExhausted: boolean;
  lastInventorySuccessAt: boolean;
  activeEntityCount: number;
  unresolvedFrontier: boolean;
}

async function assessCollegeEvidence(
  prisma: ReturnType<typeof createScriptPrisma>,
  collegeId: string
): Promise<CoverageEvidence> {
  const [directorySources, checkpoint, college, activeEntityCount] = await Promise.all([
    prisma.source.count({
      where: {
        collegeId,
        pageRole: { contains: "housing_directory" },
      },
    }),
    prisma.ingestCheckpoint.findUnique({ where: { collegeId } }),
    prisma.college.findUnique({
      where: { id: collegeId },
      select: { lastInventorySuccessAt: true },
    }),
    prisma.dorm.count({
      where: { collegeId, isActive: true, dataQualityStatus: "ACTIVE" },
    }),
  ]);

  // Old scraper set stage=complete whenever dormsFound>0 — that is NOT exhaustion.
  // Require explicit metadata flag from the new coverage decision path.
  const meta = (checkpoint?.metadata ?? {}) as Record<string, unknown>;
  const checkpointExhausted =
    meta.directoryExhausted === true ||
    meta.coverageDecision === "COMPLETE";

  const unresolved =
    Array.isArray(checkpoint?.candidateUrls) &&
    checkpoint!.candidateUrls.length > 5 &&
    !checkpointExhausted;

  return {
    hasOfficialDirectoryPageRole: directorySources > 0,
    checkpointExhausted,
    lastInventorySuccessAt: college?.lastInventorySuccessAt != null,
    activeEntityCount,
    unresolvedFrontier: unresolved,
  };
}

function hasCompleteEvidence(evidence: CoverageEvidence): boolean {
  // Strict: inventory success from new scraper + directory page + exhausted checkpoint
  return (
    evidence.lastInventorySuccessAt &&
    evidence.hasOfficialDirectoryPageRole &&
    evidence.checkpointExhausted &&
    evidence.activeEntityCount > 0 &&
    !evidence.unresolvedFrontier
  );
}

async function main() {
  const apply = isApplyMode();
  printModeBanner(apply);
  const prisma = createScriptPrisma();

  try {
    const completeColleges = await prisma.college.findMany({
      where: { housingCoverageStatus: HousingCoverageStatus.COMPLETE },
      select: { id: true, name: true, slug: true },
    });

    const downgrades: Array<{
      slug: string;
      name: string;
      activeEntityCount: number;
      missing: string[];
    }> = [];

    for (const college of completeColleges) {
      const evidence = await assessCollegeEvidence(prisma, college.id);
      if (hasCompleteEvidence(evidence)) continue;

      const missing: string[] = [];
      if (!evidence.hasOfficialDirectoryPageRole) missing.push("directory_page_role");
      if (!evidence.checkpointExhausted) missing.push("directory_not_exhausted");
      if (!evidence.lastInventorySuccessAt) missing.push("inventory_success");
      if (evidence.activeEntityCount === 0) missing.push("no_active_entities");
      if (evidence.unresolvedFrontier) missing.push("unresolved_frontier");

      downgrades.push({
        slug: college.slug,
        name: college.name,
        activeEntityCount: evidence.activeEntityCount,
        missing,
      });

      if (apply) {
        await prisma.college.update({
          where: { id: college.id },
          data: { housingCoverageStatus: HousingCoverageStatus.PARTIAL },
        });
      }
    }

    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry_run",
          completeColleges: completeColleges.length,
          downgraded: downgrades.length,
          samples: downgrades.slice(0, 25),
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
