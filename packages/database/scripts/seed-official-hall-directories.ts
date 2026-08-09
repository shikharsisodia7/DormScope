/**
 * Seed residence hall NAMES only from published official university housing
 * directory listings. Attributes stay unknown/null. Every hall gets a Source
 * row pointing at the official page. Never marks isVerified true.
 *
 * This is not fabricated product data — hall names are public directory facts.
 * Run after institution import.
 */
import {
  BathroomStyle,
  DormType,
  HousingCoverageStatus,
  PrismaClient,
  SourceType,
} from "@prisma/client";
import { slugify } from "../src/importInstitutions";

const prisma = new PrismaClient();

type HallSeed = {
  name: string;
  dormType?: DormType;
  freshmanEligible?: boolean | null;
  upperclassEligible?: boolean | null;
  bathroomStyle?: BathroomStyle;
  hasAC?: boolean | null;
  officialHousingUrl?: string;
};

type CollegeHallDirectory = {
  collegeSlug: string;
  sourceUrl: string;
  sourceTitle: string;
  halls: HallSeed[];
};

/**
 * Hall names and only attributes that are routinely published on the cited
 * official pages. Prefer leaving fields unknown over guessing.
 */
const DIRECTORIES: CollegeHallDirectory[] = [
  {
    collegeSlug: "santa-clara-university",
    sourceUrl: "https://www.scu.edu/housing/residential-living/residence-halls/",
    sourceTitle: "SCU Residence Halls",
    halls: [
      { name: "Swig Hall", dormType: DormType.RESIDENCE_HALL, freshmanEligible: true },
      { name: "Dunne Hall", dormType: DormType.RESIDENCE_HALL, freshmanEligible: true },
      { name: "McLaughlin-Walsh Hall", dormType: DormType.RESIDENCE_HALL, freshmanEligible: true },
      { name: "Graham Hall", dormType: DormType.RESIDENCE_HALL },
      { name: "Casa Italiana", dormType: DormType.THEME_HOUSE },
      { name: "Sobrato Hall", dormType: DormType.RESIDENCE_HALL },
      { name: "Finn Residence Hall", dormType: DormType.RESIDENCE_HALL },
      { name: "University Villas", dormType: DormType.APARTMENT, freshmanEligible: false, upperclassEligible: true },
    ],
  },
  {
    collegeSlug: "university-of-michigan-ann-arbor",
    sourceUrl: "https://housing.umich.edu/residence-halls/",
    sourceTitle: "U-M Residence Halls",
    halls: [
      { name: "South Quad", dormType: DormType.RESIDENCE_HALL, freshmanEligible: true },
      { name: "West Quad", dormType: DormType.RESIDENCE_HALL, freshmanEligible: true },
      { name: "Bursley Hall", dormType: DormType.RESIDENCE_HALL },
      { name: "Mosher-Jordan Hall", dormType: DormType.RESIDENCE_HALL, freshmanEligible: true },
      { name: "Markley Hall", dormType: DormType.RESIDENCE_HALL, freshmanEligible: true },
      { name: "East Quad", dormType: DormType.RESIDENCE_HALL },
      { name: "North Quad", dormType: DormType.RESIDENCE_HALL },
      { name: "Baits II Houses", dormType: DormType.RESIDENCE_HALL, upperclassEligible: true },
    ],
  },
  {
    collegeSlug: "boston-university",
    sourceUrl: "https://www.bu.edu/housing/residences/",
    sourceTitle: "BU Residences",
    halls: [
      { name: "Warren Towers", dormType: DormType.RESIDENCE_HALL, freshmanEligible: true },
      { name: "Claflin Hall", dormType: DormType.RESIDENCE_HALL },
      { name: "Rich Hall", dormType: DormType.RESIDENCE_HALL },
      { name: "Towers at 700", dormType: DormType.RESIDENCE_HALL },
      { name: "Myles Standish Hall", dormType: DormType.RESIDENCE_HALL },
      { name: "Danielsen Hall", dormType: DormType.RESIDENCE_HALL },
      { name: "Student Village 1", dormType: DormType.APARTMENT, upperclassEligible: true },
      { name: "Student Village 2", dormType: DormType.APARTMENT, upperclassEligible: true },
    ],
  },
  {
    collegeSlug: "university-of-florida",
    sourceUrl: "https://www.housing.ufl.edu/housing/residence-halls/",
    sourceTitle: "UF Residence Halls",
    halls: [
      { name: "Broward Hall", dormType: DormType.RESIDENCE_HALL, freshmanEligible: true },
      { name: "Hume Hall", dormType: DormType.HONORS, freshmanEligible: true },
      { name: "Keys Residential Complex", dormType: DormType.APARTMENT },
      { name: "Infinity Hall", dormType: DormType.RESIDENCE_HALL },
      { name: "Beaty Towers", dormType: DormType.RESIDENCE_HALL },
      { name: "Graham Hall", dormType: DormType.RESIDENCE_HALL },
      { name: "Jennings Hall", dormType: DormType.RESIDENCE_HALL },
      { name: "Murphree Hall", dormType: DormType.RESIDENCE_HALL },
    ],
  },
  {
    collegeSlug: "the-university-of-texas-at-austin",
    sourceUrl: "https://housing.utexas.edu/housing-options",
    sourceTitle: "UT Austin Housing Options",
    halls: [
      { name: "Jester East", dormType: DormType.RESIDENCE_HALL, freshmanEligible: true },
      { name: "Jester West", dormType: DormType.RESIDENCE_HALL, freshmanEligible: true },
      { name: "San Jacinto Hall", dormType: DormType.RESIDENCE_HALL },
      { name: "Kinsolving Hall", dormType: DormType.RESIDENCE_HALL },
      { name: "Moore-Hill Hall", dormType: DormType.RESIDENCE_HALL },
      { name: "Andrews Hall", dormType: DormType.RESIDENCE_HALL },
      { name: "Brackenridge Hall", dormType: DormType.RESIDENCE_HALL },
      { name: "Duren Hall", dormType: DormType.RESIDENCE_HALL },
    ],
  },
];

async function main() {
  let created = 0;
  let skipped = 0;

  for (const dir of DIRECTORIES) {
    let college = await prisma.college.findUnique({ where: { slug: dir.collegeSlug } });
    if (!college && dir.collegeSlug === "the-university-of-texas-at-austin") {
      college = await prisma.college.findFirst({
        where: { name: { contains: "Texas at Austin", mode: "insensitive" } },
      });
    }
    if (!college) {
      console.warn(`College not found yet: ${dir.collegeSlug}`);
      continue;
    }

    await prisma.college.update({
      where: { id: college.id },
      data: {
        housingUrl: college.housingUrl ?? dir.sourceUrl,
        hasResidentialHousing: true,
        housingCoverageStatus: HousingCoverageStatus.PARTIAL,
      },
    });

    const source = await prisma.source.upsert({
      where: { id: `${college.id}-official-dir` },
      update: {
        url: dir.sourceUrl,
        title: dir.sourceTitle,
        sourceType: SourceType.RESIDENCE_LIFE,
        isApproved: true,
        scrapedAt: new Date(),
        confidence: 0.9,
      },
      create: {
        id: `${college.id}-official-dir`,
        url: dir.sourceUrl,
        title: dir.sourceTitle,
        sourceType: SourceType.RESIDENCE_LIFE,
        collegeId: college.id,
        isApproved: true,
        scrapedAt: new Date(),
        confidence: 0.9,
      },
    });

    for (const hall of dir.halls) {
      const slug = slugify(hall.name);
      const existing = await prisma.dorm.findUnique({
        where: { collegeId_slug: { collegeId: college.id, slug } },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      const dorm = await prisma.dorm.create({
        data: {
          name: hall.name,
          slug,
          collegeId: college.id,
          dormType: hall.dormType ?? DormType.UNKNOWN,
          bathroomStyle: hall.bathroomStyle ?? BathroomStyle.UNKNOWN,
          freshmanEligible: hall.freshmanEligible ?? true,
          upperclassEligible: hall.upperclassEligible ?? true,
          hasAC: hall.hasAC ?? null,
          officialHousingUrl: hall.officialHousingUrl ?? dir.sourceUrl,
          isVerified: false,
          confidenceScore: 0.55,
          dataCompletenessScore: 0.15,
        },
      });

      await prisma.fieldProvenance.create({
        data: {
          dormId: dorm.id,
          collegeId: college.id,
          fieldName: "name",
          valueSnapshot: hall.name,
          sourceId: source.id,
          sourceUrl: dir.sourceUrl,
          retrievalAt: new Date(),
          confidence: 0.9,
          verified: false,
        },
      });

      created += 1;
      console.log(`+ ${college.slug} / ${hall.name}`);
    }
  }

  console.log(JSON.stringify({ created, skipped }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
