import { getDatabase } from "../../../../../db";
import { authorizedReplayBatch, replayBatchToken } from "../../../../../lib/replay-batch-access.mjs";
import { aggregateReplayBatch, REPLAY_BATCH_AGGREGATION_VERSION, validateBatchCandidate } from "../../../../../lib/replay-batch.mjs";
import { requestRocketLeagueAnalysis, resolveRocketLeagueEngine } from "../../../../../lib/rl-engine-client.mjs";
import { isSameOriginRequest, operationalErrorCode } from "../../../../../lib/request-security.mjs";
import { subsystemEnabled } from "../../../../../lib/subsystem-controls.mjs";
import type { AdapterSuccess } from "../../../../../lib/core/contracts";
import { sendReplayBatchReady } from "../../../../../lib/email";

export const runtime = "edge";
const headers = { "Cache-Control": "no-store" };

type BatchItem = {
  id: number; publicId: string; uploadSessionId: number; jobPublicId: string; status: string; attempts: number;
  fileName: string; fileSha256: string | null; objectKey: string | null; uploadStatus: string;
};

async function exclude(database: D1Database, batch: Record<string, unknown>, item: BatchItem, code: string, message: string, candidates: string[] = []) {
  const awaiting = ["subject_player_required", "subject_player_ambiguous"].includes(code) && !batch.subjectDisplayName && candidates.length > 0;
  await database.batch([
    database.prepare(`UPDATE replay_batch_items SET status = ?, candidate_players_json = ?, error_code = ?, error_message = ?,
      updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(awaiting ? "awaiting_player" : "excluded", JSON.stringify(candidates), code, message, item.id),
    database.prepare(`UPDATE replay_batches SET excluded_count = excluded_count + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(awaiting ? 0 : 1, batch.id),
    database.prepare(`UPDATE analysis_jobs SET status = 'collecting', stage = ?, stage_label = ?, error_code = ?,
      error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE analysis_request_id = ?`)
      .bind(awaiting ? "identity" : "collecting", awaiting ? "Choose the player found in replay 1" : `${Number(batch.validCount)} of 10 verified replays`, code, message, batch.analysisRequestId),
  ]);
  return Response.json({
    status: awaiting ? "awaiting_player" : "excluded",
    validCount: Number(batch.validCount),
    targetCount: Number(batch.targetCount),
    excludedCount: Number(batch.excludedCount) + (awaiting ? 0 : 1),
    candidatePlayers: candidates,
    errorCode: code,
    error: message,
    replacementRequired: !awaiting,
  }, { status: awaiting ? 200 : 422, headers });
}

async function finalizeBatch(database: D1Database, bucket: R2Bucket, batch: Record<string, unknown>, privateReportUrl: string) {
  const valid = await database.prepare(`SELECT result_object_key AS resultObjectKey FROM replay_batch_items
    WHERE batch_id = ? AND status = 'valid' ORDER BY valid_slot`).bind(batch.id).all<{ resultObjectKey: string }>();
  if ((valid.results || []).length !== 10) return false;
  const results = [];
  for (const item of valid.results || []) {
    const stored = await bucket.get(item.resultObjectKey);
    if (!stored) throw new Error("A verified batch result is missing from private storage.");
    results.push(await stored.json());
  }
  const aggregate = aggregateReplayBatch(results, Number(batch.excludedCount));
  const first = results[0];
  const metadata = {
    ...aggregate.metadata,
    earlyAccess: {
      coachingStatus: aggregate.report ? "experimental_insight" : "abstained",
      formalValidationStatus: "not_validated",
      policyVersion: REPLAY_BATCH_AGGREGATION_VERSION,
      verifiedFacts: {
        subjectDisplayName: first.normalized?.subjectDisplayName || null,
        mode: batch.playlist || first.normalized?.mode || null,
        rank: batch.currentRank || null,
        rankProvenance: "player_submitted",
        occurredAt: first.normalized?.occurredAt || null,
        playerCount: null,
        sampledFrames: null,
        parserEvents: null,
        decisionEvents: null,
      },
      assessments: aggregate.metadata.batch.recurrence.map(entry => ({
        detectorId: entry.detectorId,
        status: "experimental_insight",
        reason: `${entry.matches} of 10 verified matches; average confidence ${Math.round(entry.averageConfidence * 100)}%.`,
      })),
    },
  };
  const aggregateKey = `normalized/rocket-league/${batch.publicId}/ten-match-baseline.v1.json`;
  await bucket.put(aggregateKey, JSON.stringify({ metadata, report: aggregate.report }), {
    httpMetadata: { contentType: "application/json" },
    customMetadata: { requestId: String(batch.publicId), schemaVersion: REPLAY_BATCH_AGGREGATION_VERSION },
  });
  const match = await database.prepare(`INSERT INTO matches (
      public_id, analysis_request_id, player_id, game, ingestion_source, normalized_object_key,
      mode, rank, occurred_at, parser_version, normalized_schema_version, metadata_json
    ) VALUES (?, ?, ?, 'rocket-league', 'replay_batch', ?, ?, ?, ?, ?, 'game-data.v1', ?)
    ON CONFLICT(analysis_request_id) DO UPDATE SET normalized_object_key = excluded.normalized_object_key,
      mode = excluded.mode, rank = excluded.rank, occurred_at = excluded.occurred_at,
      parser_version = excluded.parser_version, metadata_json = excluded.metadata_json
    RETURNING id`).bind(
      crypto.randomUUID().replaceAll("-", ""), batch.analysisRequestId, batch.playerId, aggregateKey,
      batch.playlist, batch.currentRank, first.normalized?.occurredAt || null,
      aggregate.versions.parser, JSON.stringify(metadata),
    ).first<{ id: number }>();
  if (!match) throw new Error("Could not persist the ten-match baseline.");
  await database.prepare("DELETE FROM analysis_findings WHERE analysis_request_id = ?").bind(batch.analysisRequestId).run();
  if (aggregate.report) {
    const finding = aggregate.report.finding;
    await database.prepare(`INSERT INTO analysis_findings (
        public_id, analysis_request_id, match_id, player_id, game, priority, category, title, summary,
        severity, confidence, confidence_label, frequency, estimated_impact, evidence_json, metrics_json,
        recommendation_json, limitations_json, detector_id, detector_version, schema_version
      ) VALUES (?, ?, ?, ?, 'rocket-league', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'finding.v1')`)
      .bind(
        crypto.randomUUID().replaceAll("-", ""), batch.analysisRequestId, match.id, batch.playerId,
        finding.category, finding.title, finding.summary, finding.severity, finding.confidence,
        finding.confidenceLabel, finding.frequency, finding.estimatedImpact || null,
        JSON.stringify(finding.evidence), JSON.stringify(finding.metrics || []), JSON.stringify(finding.recommendation),
        JSON.stringify(finding.limitations), finding.id, finding.detectorVersion,
      ).run();
  }
  const readyAt = new Date().toISOString();
  const report = aggregate.report;
  await database.batch([
    database.prepare(`UPDATE analysis_usage SET status = 'consumed', consumed_at = ?, released_at = NULL,
      updated_at = CURRENT_TIMESTAMP WHERE analysis_request_id = ? AND status = 'reserved'`).bind(readyAt, batch.analysisRequestId),
    database.prepare(`UPDATE analysis_requests SET status = 'ready', highest_impact_mistake = ?, why_it_costs = ?,
      evidence_moments = ?, next_queue_rule = ?, practice_plan = ?, coach_note = ?, ready_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`).bind(
        report?.highestImpactMistake || null, report?.whyItCosts || null,
        report ? report.evidence.map(item => item.description).join("\n") : null,
        report?.nextQueueRule || null, report?.practicePlan.join("\n") || null,
        report?.coachNote || "No coaching plan was released because no detector recurred across at least three of the ten verified matches.",
        readyAt, batch.analysisRequestId,
      ),
    database.prepare(`UPDATE analysis_jobs SET status = 'completed', stage = 'completed', stage_label = ?,
      parser_version = ?, analyzer_version = ?, detector_version = ?, coaching_version = ?, schema_version = ?,
      completed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE analysis_request_id = ?`).bind(
        report ? "Ten-match baseline ready" : "Ten-match facts-only baseline ready",
        aggregate.versions.parser, aggregate.versions.analyzer, aggregate.versions.detector,
        aggregate.versions.coaching, aggregate.versions.schema, readyAt, batch.analysisRequestId,
      ),
    database.prepare(`UPDATE replay_batches SET status = 'ready', aggregation_version = ?, confidence_label = ?,
      completed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(
        REPLAY_BATCH_AGGREGATION_VERSION, aggregate.confidence, readyAt, batch.id,
      ),
  ]);
  try {
    await sendReplayBatchReady({ database, analysisRequestId: Number(batch.analysisRequestId), analysisPublicId: String(batch.publicId),
      email: String(batch.email), game: "rocket-league", url: privateReportUrl,
      focus: report?.highestImpactMistake || "No recurring focus cleared the evidence gate.", hasPlan: Boolean(report) });
  } catch (error) {
    console.warn("ten-replay ready email failed", { code: operationalErrorCode(error) });
  }
  return true;
}

export async function POST(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ error: "Invalid replay processing request." }, { status: 403, headers });
    const { batchId } = await params;
    const database = await getDatabase();
    const batch = await authorizedReplayBatch(database, request, batchId);
    if (!batch) return Response.json({ error: "Replay batch not found." }, { status: 404, headers });
    if (batch.status === "ready") return Response.json({ status: "ready", validCount: 10, targetCount: 10, reportUrl: `/report/${batch.publicId}` }, { headers });
    const item = await database.prepare(`SELECT i.id, i.public_id AS publicId, i.upload_session_id AS uploadSessionId,
        i.job_public_id AS jobPublicId, i.status, i.attempts, i.file_name AS fileName,
        s.file_sha256 AS fileSha256, s.object_key AS objectKey, s.status AS uploadStatus
      FROM replay_batch_items i JOIN replay_upload_sessions s ON s.id = i.upload_session_id
      WHERE i.batch_id = ? AND i.status IN ('uploading', 'uploaded', 'processing', 'retry')
      ORDER BY i.id LIMIT 1`).bind(batch.id).first<BatchItem>();
    if (!item) return Response.json({ status: "collecting", validCount: Number(batch.validCount), targetCount: Number(batch.targetCount) }, { headers });
    if (item.uploadStatus !== "complete" || !item.objectKey || !item.fileSha256) {
      return Response.json({ status: "uploading", validCount: Number(batch.validCount), targetCount: Number(batch.targetCount) }, { status: 202, headers: { ...headers, "Retry-After": "2" } });
    }
    if (item.status !== "processing") {
      await database.prepare(`UPDATE replay_batch_items SET status = 'processing', file_sha256 = ?, attempts = attempts + 1,
        updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('uploading', 'uploaded', 'retry')`)
        .bind(item.fileSha256, item.id).run();
    }
    const duplicateHash = await database.prepare(`SELECT id FROM replay_batch_items WHERE batch_id = ? AND id <> ?
      AND status = 'valid' AND file_sha256 = ? LIMIT 1`).bind(batch.id, item.id, item.fileSha256).first();
    if (duplicateHash) return exclude(database, batch, item, "duplicate_file", "That exact replay file is already in this batch. Choose a different match.");

    const { env } = await import("cloudflare:workers");
    const runtime = env as unknown as Record<string, unknown> & { BUCKET?: R2Bucket; RL_ENGINE_ENABLED?: string; RL_ENGINE_URL?: string; RL_ENGINE_TOKEN?: string; RL_ENGINE_TIMEOUT_MS?: string; RL_EARLY_ACCESS_OUTPUT_ENABLED?: string };
    if (!runtime.BUCKET || !subsystemEnabled(runtime.RL_ENGINE_ENABLED)) throw new Error("Replay processing bindings are unavailable.");
    const engine = resolveRocketLeagueEngine(runtime);
    if (!engine.ok) throw new Error(engine.reason || "Replay engine is not configured.");
    const replay = await runtime.BUCKET.get(item.objectKey);
    if (!replay) return exclude(database, batch, item, "raw_input_missing", "The uploaded replay could not be found. Upload a replacement.");
    const response = await requestRocketLeagueAnalysis(engine, {
      requestId: Number(batch.analysisRequestId), publicId: String(batch.publicId), jobPublicId: item.jobPublicId,
      playerId: Number(batch.playerId), game: "rocket-league", platform: "pc", currentRank: String(batch.currentRank || "Unknown"),
      targetRank: null, playerContext: batch.subjectDisplayName ? String(batch.subjectDisplayName) : null,
      evidenceType: "replay_file", evidenceUrl: null, fileKey: item.objectKey, goal: String(batch.goal || ""), notes: null,
      providerAccountId: null, providerRegion: null, providerConnectionStatus: null,
      earlyAccessOutputEnabled: subsystemEnabled(runtime.RL_EARLY_ACCESS_OUTPUT_ENABLED),
    }, replay.body);
    if (response.status === 202) {
      await database.prepare(`UPDATE analysis_jobs SET status = 'running', stage = 'ingesting', stage_label = ?,
        updated_at = CURRENT_TIMESTAMP WHERE analysis_request_id = ?`).bind(`Verifying replay ${Number(batch.validCount) + 1} of 10`, batch.analysisRequestId).run();
      return Response.json({ status: "processing", validCount: Number(batch.validCount), targetCount: Number(batch.targetCount) }, { status: 202, headers: { ...headers, "Retry-After": "3" } });
    }
    if (response.status === 422) {
      const detail = await response.json().catch(() => ({})) as { code?: string; publicMessage?: string; candidatePlayers?: string[] };
      return exclude(database, batch, item, detail.code || "invalid_replay", detail.publicMessage || "This replay could not be verified.", Array.isArray(detail.candidatePlayers) ? detail.candidatePlayers : []);
    }
    if (response.status === 408 || response.status === 429 || response.status >= 500) {
      await database.prepare(`UPDATE replay_batch_items SET status = 'retry', job_public_id = ?, error_code = 'engine_retry',
        error_message = 'The replay worker will retry this saved file.', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(crypto.randomUUID().replaceAll("-", ""), item.id).run();
      return Response.json({ status: "retry", validCount: Number(batch.validCount), targetCount: Number(batch.targetCount) }, { status: 202, headers: { ...headers, "Retry-After": "4" } });
    }
    if (!response.ok) throw new Error(`Replay engine returned HTTP ${response.status}.`);
    const result = await response.json() as AdapterSuccess;
    if (result.kind !== "success" || result.normalized?.game !== "rocket-league") throw new Error("Replay engine returned an invalid success contract.");
    const duplicateMatch = result.normalized.externalMatchId ? await database.prepare(`SELECT id FROM replay_batch_items
      WHERE batch_id = ? AND id <> ? AND status = 'valid' AND external_match_id = ? LIMIT 1`)
      .bind(batch.id, item.id, result.normalized.externalMatchId).first() : null;
    const validation = validateBatchCandidate(batch, result.normalized, { fileHash: Boolean(duplicateHash), matchGuid: Boolean(duplicateMatch) });
    if (!validation.ok) return exclude(database, batch, item, validation.code, validation.message);
    const normalizedKey = `normalized/rocket-league/${item.jobPublicId}/game-data.v1.json`;
    const resultKey = `normalized/rocket-league/${item.jobPublicId}/batch-result.v1.json`;
    await Promise.all([
      runtime.BUCKET.put(normalizedKey, JSON.stringify(result.normalized), { httpMetadata: { contentType: "application/json" } }),
      runtime.BUCKET.put(resultKey, JSON.stringify(result), { httpMetadata: { contentType: "application/json" } }),
    ]);
    const nextSlot = Number(batch.validCount) + 1;
    const accepted = await database.prepare(`UPDATE replay_batches SET valid_count = valid_count + 1,
      subject_player_id = COALESCE(subject_player_id, ?), subject_display_name = COALESCE(subject_display_name, ?),
      playlist = COALESCE(playlist, ?), updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'collecting' AND valid_count = ? AND valid_count < target_count`)
      .bind(result.normalized.subjectPlayerId, result.normalized.subjectDisplayName, validation.playlist, batch.id, Number(batch.validCount)).run();
    if (!accepted.meta.changes) return Response.json({ status: "processing", validCount: Number(batch.validCount), targetCount: 10 }, { status: 202, headers });
    await database.batch([
      database.prepare(`UPDATE replay_batch_items SET status = 'valid', valid_slot = ?, file_sha256 = ?,
        external_match_id = ?, subject_player_id = ?, subject_display_name = ?, playlist = ?, occurred_at = ?,
        normalized_object_key = ?, result_object_key = ?, candidate_players_json = NULL, error_code = NULL,
        error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(
          nextSlot, item.fileSha256, result.normalized.externalMatchId, result.normalized.subjectPlayerId,
          result.normalized.subjectDisplayName, validation.playlist, result.normalized.occurredAt || null,
          normalizedKey, resultKey, item.id,
        ),
      database.prepare(`UPDATE replay_upload_sessions SET status = 'claimed', claimed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'complete'`).bind(item.uploadSessionId),
      database.prepare(`UPDATE analysis_jobs SET status = 'collecting', stage = 'collecting', stage_label = ?,
        error_code = NULL, error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE analysis_request_id = ?`)
        .bind(`${nextSlot} of 10 verified replays`, batch.analysisRequestId),
      database.prepare(`UPDATE analysis_requests SET player_context = COALESCE(player_context, ?), current_rank = ?,
        status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(
          result.normalized.subjectDisplayName, batch.currentRank || "Read from ten verified replays", nextSlot === 10 ? "analyzing" : "collecting", batch.analysisRequestId,
        ),
    ]);
    if (nextSlot === 10) {
      const finalBatch = { ...batch, validCount: 10, subjectPlayerId: result.normalized.subjectPlayerId,
        subjectDisplayName: result.normalized.subjectDisplayName, playlist: validation.playlist };
      const reportUrl = new URL(`/report/${batch.publicId}`, request.url);
      reportUrl.searchParams.set("access", replayBatchToken(request));
      await finalizeBatch(database, runtime.BUCKET, finalBatch, reportUrl.toString());
      return Response.json({ status: "ready", validCount: 10, targetCount: 10, reportUrl: `/report/${batch.publicId}` }, { headers });
    }
    return Response.json({ status: "collecting", validCount: nextSlot, targetCount: 10, accepted: true, playlist: validation.playlist, subjectDisplayName: result.normalized.subjectDisplayName }, { headers });
  } catch (error) {
    console.error("batch replay processing failed", { code: operationalErrorCode(error) });
    return Response.json({ error: "This saved replay could not be processed yet. Retry without uploading it again." }, { status: 500, headers: { ...headers, "Retry-After": "4" } });
  }
}
