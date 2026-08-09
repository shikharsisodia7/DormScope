import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Validation failed", details: err.flatten() });
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  console.error("[api]", message);
  if (process.env.NODE_ENV === "production") {
    return res.status(500).json({ error: "Internal server error" });
  }
  return res.status(500).json({ error: message });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
