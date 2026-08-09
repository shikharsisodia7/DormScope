import { Router } from "express";
import { z } from "zod";
import { prisma } from "@dormscope/database";
import { asyncHandler } from "../middleware/errorHandler.js";

export const correctionsRouter = Router();

const schema = z.object({
  dormId: z.string().min(1),
  fieldName: z.string().min(1).max(80),
  proposedValue: z.string().min(1).max(2000),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  submitterNote: z.string().max(1000).optional(),
});

correctionsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = schema.parse(req.body);
    const dorm = await prisma.dorm.findUnique({ where: { id: input.dormId }, select: { id: true } });
    if (!dorm) return res.status(404).json({ error: "Dorm not found" });

    const correction = await prisma.dataCorrection.create({
      data: {
        dormId: input.dormId,
        fieldName: input.fieldName,
        proposedValue: input.proposedValue,
        sourceUrl: input.sourceUrl || null,
        submitterNote: input.submitterNote,
        status: "PENDING",
      },
      select: { id: true, status: true, createdAt: true },
    });
    res.status(201).json({ correction, message: "Correction submitted for review" });
  })
);
