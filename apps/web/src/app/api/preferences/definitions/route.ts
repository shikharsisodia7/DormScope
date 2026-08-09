import { listPreferenceDimensions, defaultPreferenceWeights, emptyHardConstraints } from "@dormscope/shared";
import { jsonOk } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return jsonOk({
    dimensions: listPreferenceDimensions(),
    defaultWeights: defaultPreferenceWeights(),
    emptyHardConstraints: emptyHardConstraints(),
  });
}
