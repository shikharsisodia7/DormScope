import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  apiKey: z.string().min(1).optional(),
});

/**
 * Validates ADMIN_API_KEY. Clients should send subsequent mutating admin
 * requests with header `x-admin-key: <ADMIN_API_KEY>`.
 */
export async function POST(req: Request) {
  try {
    const expected = process.env.ADMIN_API_KEY;
    if (!expected) return jsonError("Admin auth not configured", 503);

    const headerKey =
      req.headers.get("x-admin-key") ??
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const body = loginSchema.safeParse(await req.json().catch(() => ({})));
    const key = headerKey || body.data?.apiKey;

    if (!key || key !== expected) return jsonError("Invalid admin key", 401);

    return jsonOk({
      ok: true,
      message: "Admin key accepted. Send x-admin-key on mutating admin routes.",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
