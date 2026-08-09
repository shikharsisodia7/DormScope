import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Development seed — catalog data only.
 *
 * Does NOT fabricate dorms, reviews, scrape jobs, or verified attributes.
 * Colleges/dorms should come from the importer / scraper pipeline.
 */
const AMENITIES = [
  { name: "Air Conditioning", normalized: "ac", category: "climate" },
  { name: "Heating", normalized: "heating", category: "climate" },
  { name: "In-Room Kitchen", normalized: "kitchen", category: "living" },
  { name: "Laundry", normalized: "laundry", category: "utilities" },
  { name: "Study Lounge", normalized: "study_lounge", category: "academic" },
  { name: "Fitness Center Nearby", normalized: "gym_nearby", category: "wellness" },
  { name: "Elevator", normalized: "elevator", category: "accessibility" },
  { name: "Wheelchair Accessible", normalized: "wheelchair_accessible", category: "accessibility" },
  { name: "Wi-Fi", normalized: "wifi", category: "utilities" },
  { name: "Furnished Room", normalized: "furnished", category: "living" },
  { name: "Substance-Free", normalized: "substance_free", category: "lifestyle" },
  { name: "Quiet Housing", normalized: "quiet_housing", category: "lifestyle" },
  { name: "Living-Learning Community", normalized: "living_learning", category: "academic" },
  { name: "Meal Plan Required", normalized: "meal_plan_required", category: "dining" },
];

async function main() {
  console.log("Seeding DormScope catalog (amenities + admin only)...");

  for (const a of AMENITIES) {
    await prisma.amenity.upsert({
      where: { normalized: a.normalized },
      update: { name: a.name, category: a.category },
      create: a,
    });
  }

  const admin = await prisma.user.upsert({
    where: { email: "admin@dormscope.com" },
    update: { role: "ADMIN", name: "DormScope Admin" },
    create: {
      email: "admin@dormscope.com",
      name: "DormScope Admin",
      role: "ADMIN",
    },
  });

  console.log(
    `Seed complete: ${AMENITIES.length} amenities, admin=${admin.email}. No fabricated dorms or scrape jobs.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
