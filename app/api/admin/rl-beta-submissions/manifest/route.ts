import { asc } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { rlBetaSubmissions } from "../../../../../db/schema";
import { requireSiteAdminApi } from "../../../../../lib/admin";

export async function GET() {
  const unauthorized = await requireSiteAdminApi();
  if (unauthorized) return unauthorized;
  const db = await getDb();
  const rows = await db.select({
    publicId: rlBetaSubmissions.publicId,
    replayFingerprint: rlBetaSubmissions.replayFingerprint,
    playerName: rlBetaSubmissions.playerName,
    mode: rlBetaSubmissions.mode,
    parsedMode: rlBetaSubmissions.parsedMode,
    rankCohort: rlBetaSubmissions.rankCohort,
    consentVersion: rlBetaSubmissions.consentVersion,
    consentAt: rlBetaSubmissions.consentAt,
    status: rlBetaSubmissions.status,
    parserStatus: rlBetaSubmissions.parserStatus,
    parserVersion: rlBetaSubmissions.parserVersion,
    attributionStatus: rlBetaSubmissions.attributionStatus,
    usabilityStatus: rlBetaSubmissions.usabilityStatus,
    reviewState: rlBetaSubmissions.reviewState,
    detectorSetVersion: rlBetaSubmissions.detectorSetVersion,
  }).from(rlBetaSubmissions).orderBy(asc(rlBetaSubmissions.createdAt), asc(rlBetaSubmissions.id));
  const replays = Object.fromEntries(rows.map(row => [row.replayFingerprint, {
    publicId: row.publicId,
    playerName: row.playerName,
    mode: row.mode,
    parsedMode: row.parsedMode,
    rankCohort: row.rankCohort,
    consentVersion: row.consentVersion,
    consentAt: row.consentAt,
    status: row.status,
    parserStatus: row.parserStatus,
    parserVersion: row.parserVersion,
    attributionStatus: row.attributionStatus,
    usabilityStatus: row.usabilityStatus,
    reviewState: row.reviewState,
    detectorSetVersion: row.detectorSetVersion,
  }]));
  return Response.json({ schemaVersion: "rocket-league-calibration-manifest.v2", generatedAt: new Date().toISOString(), replays }, {
    headers: { "Cache-Control": "private, no-store", "Content-Disposition": "attachment; filename=rl-calibration-manifest.json" }
  });
}
