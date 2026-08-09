import type { Request, Response, NextFunction } from "express";

/** Require `x-admin-key` (or Bearer) matching ADMIN_API_KEY for mutating admin routes. */
export function requireAdminKey(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    return res.status(503).json({ error: "Admin auth not configured" });
  }
  const header =
    (req.headers["x-admin-key"] as string | undefined) ??
    (typeof req.headers.authorization === "string"
      ? req.headers.authorization.replace(/^Bearer\s+/i, "")
      : undefined);

  if (!header || header !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
