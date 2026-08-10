import { getAdminOverview } from "@/lib/admin-data";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    if (!(await requireAdminAuth(req))) {
      return jsonError("Unauthorized", 401);
    }
    return jsonOk(await getAdminOverview());
  } catch (err) {
    return handleRouteError(err);
  }
}
