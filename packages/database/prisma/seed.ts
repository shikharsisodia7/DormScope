import {
  PrismaClient,
  SchoolType,
  Region,
  DormType,
  BathroomStyle,
  SourceType,
  ScrapeJobStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const AMENITIES = [
  { name: "Air Conditioning", normalized: "ac", category: "climate" },
  { name: "In-Room Kitchen", normalized: "kitchen", category: "living" },
  { name: "Laundry", normalized: "laundry", category: "utilities" },
  { name: "Study Lounge", normalized: "study_lounge", category: "academic" },
  { name: "Fitness Center Nearby", normalized: "gym_nearby", category: "wellness" },
  { name: "Elevator", normalized: "elevator", category: "accessibility" },
  { name: "Wi-Fi", normalized: "wifi", category: "utilities" },
  { name: "Furnished Room", normalized: "furnished", category: "living" },
];

async function main() {
  console.log("Seeding DormScope database...");

  for (const a of AMENITIES) {
    await prisma.amenity.upsert({
      where: { normalized: a.normalized },
      update: {},
      create: a,
    });
  }

  const colleges = [
    {
      name: "Santa Clara University",
      city: "Santa Clara",
      state: "CA",
      region: Region.WEST,
      schoolType: SchoolType.PRIVATE,
      websiteUrl: "https://www.scu.edu",
      housingUrl: "https://www.scu.edu/housing/",
      acceptanceRate: 0.43,
      studentPopulation: 9000,
      latitude: 37.3496,
      longitude: -121.939,
    },
    {
      name: "University of Michigan",
      city: "Ann Arbor",
      state: "MI",
      region: Region.MIDWEST,
      schoolType: SchoolType.PUBLIC,
      websiteUrl: "https://umich.edu",
      housingUrl: "https://housing.umich.edu",
      acceptanceRate: 0.18,
      studentPopulation: 48000,
      latitude: 42.278,
      longitude: -83.7382,
    },
    {
      name: "University of Texas at Austin",
      city: "Austin",
      state: "TX",
      region: Region.SOUTHWEST,
      schoolType: SchoolType.PUBLIC,
      websiteUrl: "https://www.utexas.edu",
      housingUrl: "https://housing.utexas.edu",
      acceptanceRate: 0.31,
      studentPopulation: 52000,
      latitude: 30.2849,
      longitude: -97.7341,
    },
    {
      name: "Boston University",
      city: "Boston",
      state: "MA",
      region: Region.NORTHEAST,
      schoolType: SchoolType.PRIVATE,
      websiteUrl: "https://www.bu.edu",
      housingUrl: "https://www.bu.edu/housing",
      acceptanceRate: 0.14,
      studentPopulation: 36000,
      latitude: 42.3505,
      longitude: -71.1054,
    },
    {
      name: "University of Florida",
      city: "Gainesville",
      state: "FL",
      region: Region.SOUTHEAST,
      schoolType: SchoolType.PUBLIC,
      websiteUrl: "https://www.ufl.edu",
      housingUrl: "https://housing.ufl.edu",
      acceptanceRate: 0.23,
      studentPopulation: 60000,
      latitude: 29.6436,
      longitude: -82.3549,
    },
  ];

  const dormTemplates: Record<
    string,
    Array<{
      name: string;
      dormType: DormType;
      freshmanEligible: boolean;
      honorsHousing: boolean;
      bathroomStyle: BathroomStyle;
      hasAC: boolean;
      yearlyCost: number;
      socialVibe: number;
      quietVibe: number;
      amenities: string[];
    }>
  > = {
    "santa-clara-university": [
      {
        name: "Swig Hall",
        dormType: DormType.RESIDENCE_HALL,
        freshmanEligible: true,
        honorsHousing: false,
        bathroomStyle: BathroomStyle.COMMUNAL,
        hasAC: true,
        yearlyCost: 18500,
        socialVibe: 8.5,
        quietVibe: 3,
        amenities: ["ac", "laundry", "wifi", "furnished", "study_lounge"],
      },
      {
        name: "McLaughlin-Walsh",
        dormType: DormType.RESIDENCE_HALL,
        freshmanEligible: true,
        honorsHousing: false,
        bathroomStyle: BathroomStyle.COMMUNAL,
        hasAC: true,
        yearlyCost: 18200,
        socialVibe: 7,
        quietVibe: 5,
        amenities: ["ac", "laundry", "wifi", "furnished"],
      },
      {
        name: "Graham Hall",
        dormType: DormType.SUITE,
        freshmanEligible: false,
        honorsHousing: false,
        bathroomStyle: BathroomStyle.SUITE,
        hasAC: true,
        yearlyCost: 19800,
        socialVibe: 6,
        quietVibe: 7,
        amenities: ["ac", "laundry", "kitchen", "wifi", "furnished", "study_lounge"],
      },
      {
        name: "Casa Italiana",
        dormType: DormType.THEME_HOUSE,
        freshmanEligible: false,
        honorsHousing: false,
        bathroomStyle: BathroomStyle.SUITE,
        hasAC: true,
        yearlyCost: 19200,
        socialVibe: 7.5,
        quietVibe: 6,
        amenities: ["ac", "kitchen", "wifi", "furnished"],
      },
      {
        name: "University Villas",
        dormType: DormType.APARTMENT,
        freshmanEligible: false,
        honorsHousing: false,
        bathroomStyle: BathroomStyle.PRIVATE,
        hasAC: true,
        yearlyCost: 22400,
        socialVibe: 5,
        quietVibe: 8,
        amenities: ["ac", "kitchen", "laundry", "wifi", "furnished", "gym_nearby"],
      },
    ],
    "university-of-michigan": [
      {
        name: "South Quad",
        dormType: DormType.RESIDENCE_HALL,
        freshmanEligible: true,
        honorsHousing: false,
        bathroomStyle: BathroomStyle.COMMUNAL,
        hasAC: false,
        yearlyCost: 12800,
        socialVibe: 9,
        quietVibe: 2,
        amenities: ["laundry", "wifi", "furnished", "study_lounge"],
      },
      {
        name: "West Quad",
        dormType: DormType.RESIDENCE_HALL,
        freshmanEligible: true,
        honorsHousing: false,
        bathroomStyle: BathroomStyle.COMMUNAL,
        hasAC: false,
        yearlyCost: 12600,
        socialVibe: 8,
        quietVibe: 4,
        amenities: ["laundry", "wifi", "furnished"],
      },
      {
        name: "Bursley Hall",
        dormType: DormType.SUITE,
        freshmanEligible: true,
        honorsHousing: false,
        bathroomStyle: BathroomStyle.SUITE,
        hasAC: true,
        yearlyCost: 14200,
        socialVibe: 6,
        quietVibe: 6,
        amenities: ["ac", "laundry", "wifi", "furnished"],
      },
    ],
    "university-of-texas-at-austin": [
      {
        name: "Jester West",
        dormType: DormType.FRESHMAN_ONLY,
        freshmanEligible: true,
        honorsHousing: false,
        bathroomStyle: BathroomStyle.COMMUNAL,
        hasAC: true,
        yearlyCost: 11500,
        socialVibe: 9.5,
        quietVibe: 2,
        amenities: ["ac", "laundry", "wifi", "furnished", "study_lounge"],
      },
      {
        name: "San Jacinto Hall",
        dormType: DormType.RESIDENCE_HALL,
        freshmanEligible: true,
        honorsHousing: false,
        bathroomStyle: BathroomStyle.COMMUNAL,
        hasAC: true,
        yearlyCost: 11200,
        socialVibe: 7,
        quietVibe: 5,
        amenities: ["ac", "laundry", "wifi", "furnished"],
      },
    ],
    "boston-university": [
      {
        name: "Warren Towers",
        dormType: DormType.RESIDENCE_HALL,
        freshmanEligible: true,
        honorsHousing: false,
        bathroomStyle: BathroomStyle.COMMUNAL,
        hasAC: true,
        yearlyCost: 19800,
        socialVibe: 8,
        quietVibe: 4,
        amenities: ["ac", "laundry", "wifi", "furnished", "elevator"],
      },
      {
        name: "Claflin Hall",
        dormType: DormType.SUITE,
        freshmanEligible: false,
        honorsHousing: true,
        bathroomStyle: BathroomStyle.SUITE,
        hasAC: true,
        yearlyCost: 21500,
        socialVibe: 5,
        quietVibe: 8,
        amenities: ["ac", "laundry", "wifi", "furnished", "study_lounge"],
      },
    ],
    "university-of-florida": [
      {
        name: "Broward Hall",
        dormType: DormType.FRESHMAN_ONLY,
        freshmanEligible: true,
        honorsHousing: false,
        bathroomStyle: BathroomStyle.COMMUNAL,
        hasAC: true,
        yearlyCost: 9800,
        socialVibe: 8.5,
        quietVibe: 3,
        amenities: ["ac", "laundry", "wifi", "furnished"],
      },
      {
        name: "Hume Hall",
        dormType: DormType.HONORS,
        freshmanEligible: true,
        honorsHousing: true,
        bathroomStyle: BathroomStyle.SUITE,
        hasAC: true,
        yearlyCost: 12400,
        socialVibe: 5,
        quietVibe: 8,
        amenities: ["ac", "laundry", "wifi", "furnished", "study_lounge"],
      },
    ],
  };

  let totalDorms = 0;

  for (const c of colleges) {
    const slug = slugify(c.name);
    const college = await prisma.college.upsert({
      where: { slug },
      update: { lastUpdatedAt: new Date() },
      create: { ...c, slug },
    });

    const job = await prisma.scrapeJob.create({
      data: {
        collegeId: college.id,
        status: ScrapeJobStatus.COMPLETED,
        startedAt: new Date(Date.now() - 3600000),
        completedAt: new Date(),
        candidateUrls: [c.housingUrl ?? ""],
        dormsFound: dormTemplates[slug]?.length ?? 0,
      },
    });

    await prisma.scrapeLog.create({
      data: {
        jobId: job.id,
        level: "info",
        message: `Seed scrape completed for ${c.name}`,
        url: c.housingUrl,
      },
    });

    await prisma.source.create({
      data: {
        collegeId: college.id,
        url: c.housingUrl ?? c.websiteUrl ?? "",
        title: `${c.name} Official Housing`,
        sourceType: SourceType.OFFICIAL_WEBSITE,
        confidence: 0.95,
        isApproved: true,
        scrapedAt: new Date(),
      },
    });

    const dorms = dormTemplates[slug] ?? [];
    for (const d of dorms) {
      const dormSlug = slugify(d.name);
      const dorm = await prisma.dorm.upsert({
        where: { collegeId_slug: { collegeId: college.id, slug: dormSlug } },
        update: { lastUpdatedAt: new Date() },
        create: {
          name: d.name,
          slug: dormSlug,
          collegeId: college.id,
          dormType: d.dormType,
          freshmanEligible: d.freshmanEligible,
          upperclassEligible: !d.freshmanEligible || d.dormType !== DormType.FRESHMAN_ONLY,
          honorsHousing: d.honorsHousing,
          bathroomStyle: d.bathroomStyle,
          hasAC: d.hasAC,
          laundryAccess: d.amenities.includes("laundry"),
          kitchenAccess: d.amenities.includes("kitchen"),
          studyLounges: d.amenities.includes("study_lounge"),
          socialVibe: d.socialVibe,
          quietVibe: d.quietVibe,
          privacyRating: d.bathroomStyle === BathroomStyle.PRIVATE ? 8 : d.bathroomStyle === BathroomStyle.SUITE ? 6 : 3,
          cleanlinessRating: 7,
          yearlyCost: d.yearlyCost,
          semesterCost: Math.round(d.yearlyCost / 2),
          officialHousingUrl: c.housingUrl,
          confidenceScore: 0.88,
          dataCompletenessScore: 0.82,
          diningDistanceMeters: 200 + Math.floor(Math.random() * 800),
          isVerified: true,
          verifiedAt: new Date(),
        },
      });

      totalDorms++;

      await prisma.roomType.createMany({
        data: [
          { dormId: dorm.id, name: "Double", normalized: "double", capacity: 2, yearlyCost: d.yearlyCost, confidence: 0.85 },
          { dormId: dorm.id, name: "Single", normalized: "single", capacity: 1, yearlyCost: d.yearlyCost * 1.25, confidence: 0.8 },
        ],
        skipDuplicates: true,
      });

      const amenityRecords = await prisma.amenity.findMany({
        where: { normalized: { in: d.amenities } },
      });
      for (const am of amenityRecords) {
        await prisma.dormAmenity.upsert({
          where: { dormId_amenityId: { dormId: dorm.id, amenityId: am.id } },
          update: {},
          create: { dormId: dorm.id, amenityId: am.id, confidence: 0.9 },
        });
      }

      await prisma.housingCost.create({
        data: {
          dormId: dorm.id,
          label: "Room & Board (Annual)",
          amount: d.yearlyCost,
          period: "yearly",
          academicYear: "2025-2026",
          confidence: 0.9,
        },
      });

      const valueScore = Math.max(0, 100 - (d.yearlyCost / 250));
      const comfortScore = (d.hasAC ? 25 : 0) + (d.bathroomStyle === BathroomStyle.PRIVATE ? 30 : d.bathroomStyle === BathroomStyle.SUITE ? 20 : 10) + 45;
      const privacyScore = d.bathroomStyle === BathroomStyle.PRIVATE ? 90 : d.bathroomStyle === BathroomStyle.SUITE ? 65 : 35;
      const socialScore = d.socialVibe * 10;
      const convenienceScore = 70;
      const freshmanFit = d.freshmanEligible ? 85 : 40;
      const amenityScore = (d.amenities.length / 6) * 100;
      const dataConf = 88;
      const overall =
        valueScore * 0.15 +
        comfortScore * 0.15 +
        privacyScore * 0.12 +
        socialScore * 0.1 +
        convenienceScore * 0.1 +
        freshmanFit * 0.13 +
        amenityScore * 0.12 +
        dataConf * 0.13;

      await prisma.dormScore.upsert({
        where: { dormId: dorm.id },
        update: {
          overallScore: Math.round(overall),
          valueScore: Math.round(valueScore),
          comfortScore: Math.round(comfortScore),
          privacyScore: Math.round(privacyScore),
          socialScore: Math.round(socialScore),
          convenienceScore: Math.round(convenienceScore),
          freshmanFitScore: Math.round(freshmanFit),
          amenityScore: Math.round(amenityScore),
          dataConfidenceScore: dataConf,
          breakdown: { valueScore, comfortScore, privacyScore, socialScore, convenienceScore, freshmanFit, amenityScore, dataConf },
        },
        create: {
          dormId: dorm.id,
          overallScore: Math.round(overall),
          valueScore: Math.round(valueScore),
          comfortScore: Math.round(comfortScore),
          privacyScore: Math.round(privacyScore),
          socialScore: Math.round(socialScore),
          convenienceScore: Math.round(convenienceScore),
          freshmanFitScore: Math.round(freshmanFit),
          amenityScore: Math.round(amenityScore),
          dataConfidenceScore: dataConf,
          breakdown: { valueScore, comfortScore, privacyScore, socialScore, convenienceScore, freshmanFit, amenityScore, dataConf },
        },
      });

      const ruleSummary =
        d.freshmanEligible && d.bathroomStyle === BathroomStyle.COMMUNAL
          ? "Likely a social freshman experience with communal bathrooms — great for meeting people, less private."
          : d.dormType === DormType.APARTMENT
            ? "Apartment-style with more independence — better for upperclassmen wanting kitchen and privacy."
            : d.honorsHousing
              ? "Honors housing with quieter vibe and suite bathrooms — strong for focused students."
              : "Balanced option with mix of comfort and community.";

      const existingReview = await prisma.reviewSummary.findFirst({ where: { dormId: dorm.id } });
      if (!existingReview) {
        await prisma.reviewSummary.create({
          data: {
            dormId: dorm.id,
            vibeLabels: d.socialVibe > 7 ? ["Social", "Good for freshmen"] : d.quietVibe > 7 ? ["Quiet", "Good for privacy"] : ["Convenient"],
            pros: d.hasAC ? ["Air conditioning"] : ["Affordable"],
            cons: !d.hasAC ? ["No AC"] : d.yearlyCost > 19000 ? ["Higher cost"] : [],
            ruleBasedSummary: ruleSummary,
            confidence: 0.75,
            sourceCount: 2,
          },
        });
      }
    }

    await prisma.dataQualityReport.create({
      data: {
        collegeId: college.id,
        state: c.state,
        totalDorms: dorms.length,
        missingCost: 0,
        missingAmenities: 0,
        missingSources: 0,
        lowConfidenceCount: 0,
        duplicateWarnings: 0,
        staleRecords: 0,
        avgCompleteness: 0.85,
      },
    });
  }

  const admin = await prisma.user.upsert({
    where: { email: "admin@dormscope.com" },
    update: {},
    create: {
      email: "admin@dormscope.com",
      name: "DormScope Admin",
      role: "ADMIN",
    },
  });

  console.log(`Seeded ${colleges.length} colleges, ${totalDorms} dorms, admin: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
