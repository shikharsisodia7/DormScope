import express from "express";
import cors from "cors";
import { statsRouter } from "./routes/stats.js";
import { collegesRouter } from "./routes/colleges.js";
import { dormsRouter } from "./routes/dorms.js";
import { analyticsRouter } from "./routes/analytics.js";
import { adminRouter } from "./routes/admin.js";
import { scraperRouter } from "./routes/scraper.js";
import { recommendRouter } from "./routes/recommend.js";
import { matchRouter } from "./routes/match.js";
import { preferencesRouter } from "./routes/preferences.js";
import { reviewsRouter } from "./routes/reviews.js";
import { correctionsRouter } from "./routes/corrections.js";
import { coverageRouter } from "./routes/coverage.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { prisma } from "@dormscope/database";

const app = express();
const PORT = process.env.API_PORT ?? 4000;

app.disable("x-powered-by");
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:3000" }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: "dormscope-api", db: "up" });
  } catch {
    res.status(503).json({ ok: false, service: "dormscope-api", db: "down" });
  }
});

app.use("/api/stats", statsRouter);
app.use("/api/colleges", collegesRouter);
app.use("/api/dorms", dormsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/scraper", scraperRouter);
app.use("/api/recommend", recommendRouter);
app.use("/api/match", matchRouter);
app.use("/api/preferences", preferencesRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/corrections", correctionsRouter);
app.use("/api/coverage", coverageRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`DormScope API running on http://localhost:${PORT}`);
});
