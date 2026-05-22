import { runScraperForCollege } from "./jobs/runScraper.js";

const collegeSlug = process.argv[2];

if (!collegeSlug) {
  console.log("Usage: npm run scraper -- <college-slug>");
  console.log("Example: npm run scraper -- santa-clara-university");
  process.exit(0);
}

runScraperForCollege(collegeSlug)
  .then((r) => {
    console.log("Scrape complete:", r);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
