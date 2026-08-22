import { asc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { rlCapabilities } from "../../../../db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const rows = await db.select({
    mode: rlCapabilities.mode,
    rankCohort: rlCapabilities.rankCohort,
    upload: rlCapabilities.uploadState,
    parse: rlCapabilities.parseState,
    process: rlCapabilities.processState,
    detectors: rlCapabilities.detectorState,
    coaching: rlCapabilities.coachingState,
    reason: rlCapabilities.reason,
    sourceVersion: rlCapabilities.sourceVersion,
    updatedAt: rlCapabilities.updatedAt,
  }).from(rlCapabilities).orderBy(asc(rlCapabilities.mode), asc(rlCapabilities.rankCohort)).all();

  return Response.json({
    game: "rocket-league",
    beta: true,
    rows,
    rule: "Processing support does not imply validated coaching. Exact detector scopes remain abstention-only until their independent evidence gates pass.",
  }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}
