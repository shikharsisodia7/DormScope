import { Router } from "express";
import {
  listPreferenceDimensions,
  defaultPreferenceWeights,
  emptyHardConstraints,
} from "@dormscope/shared";

export const preferencesRouter = Router();

preferencesRouter.get("/definitions", (_req, res) => {
  res.json({
    dimensions: listPreferenceDimensions(),
    defaultWeights: defaultPreferenceWeights(),
    emptyHardConstraints: emptyHardConstraints(),
  });
});
