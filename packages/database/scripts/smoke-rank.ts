import { PrismaClient } from "@prisma/client";
import { rankDormsForPreferences, filterByHardConstraints } from "../scoring/src/personalizedRanker";
import { toRankableDorm } from "../../apps/web/src/lib/match-helpers";

async function main() {
  const prisma = new PrismaClient();
  const college = await prisma.college.findUnique({ where: { slug: "santa-clara-university" } });
  if (!college) throw new Error("missing college");
  const dorms = await prisma.dorm.findMany({
    where: { collegeId: college.id },
    include: {
      college: true,
      dormAmenities: { include: { amenity: true } },
      roomTypes: true,
      dormScore: true,
    },
  });
  const rankable = dorms.map((d) => toRankableDorm(d));

  const social = rankDormsForPreferences(
    filterByHardConstraints(rankable, {}).eligible,
    { weights: { apartmentStyle: 1, traditionalDormExperience: 4, freshmanFriendly: 3 }, hardConstraints: {} }
  );
  const apt = rankDormsForPreferences(
    filterByHardConstraints(rankable, {}).eligible,
    { weights: { apartmentStyle: 4, traditionalDormExperience: 1 }, hardConstraints: {} }
  );
  const hardApt = filterByHardConstraints(rankable, { requireApartment: true } as never);

  console.log(
    "traditional-leaning",
    social.map((r) => `${r.dorm.name}:${r.matchScore}`)
  );
  console.log(
    "apartment-leaning",
    apt.map((r) => `${r.dorm.name}:${r.matchScore}`)
  );
  console.log(
    "hard apartment eligible",
    hardApt.eligible.map((d) => d.name)
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
