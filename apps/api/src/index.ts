import express from "express";
import cors from "cors";
import { statsRouter } from "./routes/stats.js";
import { collegesRouter } from "./routes/colleges.js";
import { dormsRouter } from "./routes/dorms.js";
import { analyticsRouter } from "./routes/analytics.js";
import { adminRouter } from "./routes/admin.js";
import { scraperRouter } from "./routes/scraper.js";
import { recommendRouter } from "./routes/recommend.js";

const app = express();
const PORT = process.env.API_PORT ?? 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:3000" }));
app.use(express.json());

app.get("/health", (_, res) => res.json({ ok: true, service: "dormscope-api" }));

app.use("/api/stats", statsRouter);
app.use("/api/colleges", collegesRouter);
app.use("/api/dorms", dormsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/scraper", scraperRouter);
app.use("/api/recommend", recommendRouter);

app.listen(PORT, () => {
  console.log(`DormScope API running on http://localhost:${PORT}`);
});
