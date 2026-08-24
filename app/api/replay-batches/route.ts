import { getDatabase } from "../../../db";
import { cleanText, emailPattern } from "../../../lib/analysis";
import { attachAnalysisUsage, EntitlementError, releaseAnalysisUsage, reserveAnalysisAccess } from "../../../lib/analysis-entitlements";
import { authenticatedPlayer } from "../../../lib/player-session";
import { createPlayerToken, expiresAt, hashPlayerToken } from "../../../lib/player-identity.mjs";
import { activeOwnerQaEntitlement } from "../../../lib/owner-qa-entitlement.mjs";
import { isSameOriginRequest, operationalErrorCode } from "../../../lib/request-security.mjs";
import { subsystemEnabled } from "../../../lib/subsystem-controls.mjs";
import { REPLAY_BATCH_TARGET } from "../../../lib/replay-batch.mjs";
import { authorizedReplayBatch } from "../../../lib/replay-batch-access.mjs";
import { sendReplayBatchReceived } from "../../../lib/email";

export const runtime = "edge";
const headers = { "Cache-Control": "no-store" };
const REPORT_ACCESS_SECONDS = 90 * 24 * 60 * 60;

function privateReportUrl(requestUrl: string, publicId: string, accessToken: string) {
  const url = new URL(`/report/${publicId}`, requestUrl);
  url.searchParams.set("access", accessToken);
  return url.toString();
}

export async function POST(request: Request) {
  let reservedPublicId: string | null = null;
  try {
    if (!isSameOriginRequest(request)) return Response.json({ error: "Invalid batch request." }, { status: 403, headers });
    if (request.headers.get("content-type")?.split(";", 1)[0] !== "application/json") {
      return Response.json({ error: "Start the replay batch with JSON." }, { status: 415, headers });
    }
    const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
    const database = await getDatabase();
    const resumeId = cleanText(payload.resumeBatchId, 64);
    if (resumeId) {
      const batch = await authorizedReplayBatch(database, request, resumeId);
      if (!batch) return Response.json({ error: "That saved batch could not be verified." }, { status: 404, headers });
      return Response.json({
        batchId: batch.publicId,
        validCount: Number(batch.validCount),
        targetCount: Number(batch.targetCount),
        status: batch.status,
        subjectDisplayName: batch.subjectDisplayName,
        playlist: batch.playlist,
        reportUrl: `/report/${batch.publicId}`,
        resumed: true,
      }, { headers });
    }

    const signedIn = await authenticatedPlayer(request, database);
    const submittedEmail = cleanText(payload.email, 254).toLowerCase();
    const email = submittedEmail || signedIn?.email.toLowerCase() || "";
    const consent = payload.dataConsent === true;
    const currentRank = cleanText(payload.currentRank, 80) || "Read from ten verified replays";
    const goal = cleanText(payload.goal, 500) || "Find the most useful pattern that recurs across these ten matches.";
    if (!emailPattern.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400, headers });
    if (!consent) return Response.json({ error: "Confirm that we may process the ten submitted replays." }, { status: 400, headers });
    const { env } = await import("cloudflare:workers");
    if (!subsystemEnabled((env as unknown as { RL_ENGINE_ENABLED?: string }).RL_ENGINE_ENABLED)) {
      return Response.json({ error: "Rocket League replay processing is temporarily paused." }, { status: 503, headers: { ...headers, "Retry-After": "3600" } });
    }

    await database.prepare(`INSERT INTO players (public_id, email, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(email) DO UPDATE SET updated_at = CURRENT_TIMESTAMP`)
      .bind(crypto.randomUUID().replaceAll("-", ""), email).run();
    const player = await database.prepare("SELECT id FROM players WHERE email = ? LIMIT 1").bind(email).first<{ id: number }>();
    if (!player) throw new Error("Could not create the player identity.");
    const ownerQa = signedIn?.id === player.id && Boolean(await activeOwnerQaEntitlement(database, player.id));

    const batchId = crypto.randomUUID().replaceAll("-", "");
    const reserved = await reserveAnalysisAccess(request, player.id, batchId) as { reportingScope?: string };
    reservedPublicId = batchId;
    const token = createPlayerToken();
    const inserted = await database.prepare(`INSERT INTO analysis_requests (
        public_id, email, game, platform, current_rank, evidence_type, goal, status,
        reporting_scope, calibration_opt_in, source
      ) VALUES (?, ?, 'rocket-league', 'pc', ?, 'replay_batch', ?, 'collecting', ?, 0, 'ten-replay-product')
      RETURNING id`).bind(batchId, email, currentRank, goal, ownerQa || reserved.reportingScope === "owner_qa" ? "owner_qa" : "product")
      .first<{ id: number }>();
    if (!inserted) throw new Error("Could not create the batch analysis.");
    await attachAnalysisUsage(batchId, inserted.id);
    await database.batch([
      database.prepare(`INSERT INTO analysis_jobs (
          public_id, analysis_request_id, player_id, game, status, stage, stage_label, schema_version
        ) VALUES (?, ?, ?, 'rocket-league', 'collecting', 'collecting', '0 of 10 verified replays', 'coaching.v1')`)
        .bind(crypto.randomUUID().replaceAll("-", ""), inserted.id, player.id),
      database.prepare(`INSERT INTO replay_batches (
          public_id, token_hash, analysis_request_id, player_id, email, target_count,
          current_rank, goal, reporting_scope, calibration_opt_in
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`)
        .bind(batchId, await hashPlayerToken(token), inserted.id, player.id, email, REPLAY_BATCH_TARGET,
          currentRank, goal, ownerQa ? "owner_qa" : "product"),
      database.prepare(`INSERT INTO analysis_report_access (token_hash, analysis_request_id, expires_at) VALUES (?, ?, ?)`)
        .bind(await hashPlayerToken(token), inserted.id, expiresAt(REPORT_ACCESS_SECONDS)),
    ]);
    reservedPublicId = null;
    const url = privateReportUrl(request.url, batchId, token);
    try {
      await sendReplayBatchReceived({ database, analysisRequestId: inserted.id, analysisPublicId: batchId, email,
        game: "rocket-league", url });
    } catch (error) {
      console.warn("ten-replay received email failed", { code: operationalErrorCode(error) });
    }
    return Response.json({
      batchId,
      batchToken: token,
      validCount: 0,
      targetCount: REPLAY_BATCH_TARGET,
      status: "collecting",
      reportUrl: url,
      ownerQa,
    }, { status: 201, headers });
  } catch (error) {
    if (reservedPublicId) {
      try { await releaseAnalysisUsage(reservedPublicId); } catch { /* best effort */ }
    }
    if (error instanceof EntitlementError) return Response.json({ error: error.message, code: error.code }, { status: error.status, headers });
    console.error("replay batch creation failed", { code: operationalErrorCode(error) });
    return Response.json({ error: "We couldn’t start the ten-replay batch. Try again." }, { status: 500, headers });
  }
}
