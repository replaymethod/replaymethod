import { ensureProductSchema } from "../../db";
import { runGameAdapter, type AdapterEnv, type AnalysisInput } from "../adapters";
import { isAnalysisGame, reportUrl } from "../analysis";
import { sendAnalysisReady } from "../email";
import { synthesizeCoaching } from "./coaching";
import type { GameId, StructuredFinding } from "./contracts";

export type PipelineEnv = AdapterEnv & {
  DB: D1Database;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_INPUT_COST_PER_MILLION?: string;
  OPENAI_OUTPUT_COST_PER_MILLION?: string;
  PUBLIC_SITE_URL?: string;
};

type JobRow = AnalysisInput & {
  jobId: number;
  jobPublicId: string;
  email: string;
  attempts: number;
  maxAttempts: number;
};

function errorText(error: unknown) {
  return (error instanceof Error ? error.message : "Unknown analysis error").slice(0, 1800);
}

async function setStage(db: D1Database, jobId: number, stage: string, label: string) {
  await db.prepare("UPDATE analysis_jobs SET stage = ?, stage_label = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(stage, label, jobId).run();
}

async function loadAndClaim(publicId: string, db: D1Database): Promise<JobRow | null> {
  const claimed = await db.prepare(`UPDATE analysis_jobs
    SET status = 'running', stage = 'validating', stage_label = 'Validating match', attempts = attempts + 1,
        started_at = COALESCE(started_at, CURRENT_TIMESTAMP), error_code = NULL, error_message = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE public_id = ? AND status IN ('queued', 'retry')`).bind(publicId).run();
  if (!claimed.meta.changes) return null;

  const row = await db.prepare(`SELECT
      j.id AS job_id, j.public_id AS job_public_id, j.player_id, j.attempts, j.max_attempts,
      r.id AS request_id, r.public_id, r.email, r.game, r.current_rank, r.target_rank,
      r.player_context, r.evidence_type, r.evidence_url, r.file_key, r.goal, r.notes
    FROM analysis_jobs j
    JOIN analysis_requests r ON r.id = j.analysis_request_id
    WHERE j.public_id = ?`).bind(publicId).first<Record<string, unknown>>();
  if (!row || !isAnalysisGame(String(row.game))) return null;
  return {
    jobId: Number(row.job_id),
    jobPublicId: String(row.job_public_id),
    requestId: Number(row.request_id),
    publicId: String(row.public_id),
    playerId: row.player_id == null ? null : Number(row.player_id),
    email: String(row.email),
    game: String(row.game) as GameId,
    currentRank: String(row.current_rank),
    targetRank: row.target_rank == null ? null : String(row.target_rank),
    playerContext: row.player_context == null ? null : String(row.player_context),
    evidenceType: String(row.evidence_type),
    evidenceUrl: row.evidence_url == null ? null : String(row.evidence_url),
    fileKey: row.file_key == null ? null : String(row.file_key),
    goal: String(row.goal),
    notes: row.notes == null ? null : String(row.notes),
    attempts: Number(row.attempts),
    maxAttempts: Number(row.max_attempts)
  };
}

async function persistFinding(db: D1Database, job: JobRow, matchId: number, finding: StructuredFinding, priority: number) {
  return db.prepare(`INSERT INTO analysis_findings (
      public_id, analysis_request_id, match_id, player_id, game, priority, category, title, summary,
      severity, confidence, confidence_label, frequency, estimated_impact, evidence_json, metrics_json,
      recommendation_json, limitations_json, detector_version, schema_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      crypto.randomUUID().replaceAll("-", ""), job.requestId, matchId, job.playerId, job.game, priority,
      finding.category, finding.title, finding.summary, finding.severity, finding.confidence,
      finding.confidenceLabel, finding.frequency ?? null, finding.estimatedImpact ?? null,
      JSON.stringify(finding.evidence), JSON.stringify(finding.metrics), JSON.stringify(finding.recommendation),
      JSON.stringify(finding.limitations), finding.detectorVersion, finding.schemaVersion
    ).run();
}

export async function processAnalysisJob(publicId: string, env: PipelineEnv) {
  await ensureProductSchema(env.DB);
  const job = await loadAndClaim(publicId, env.DB);
  if (!job) return;
  const started = Date.now();
  await env.DB.prepare("UPDATE analysis_requests SET status = 'analyzing', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(job.requestId).run();

  try {
    await setStage(env.DB, job.jobId, "ingesting", "Reading match data");
    const result = await runGameAdapter(job, env);
    if (result.kind === "blocked") {
      await env.DB.batch([
        env.DB.prepare(`UPDATE analysis_jobs SET status = ?, stage = 'blocked', stage_label = ?, error_code = ?, error_message = ?,
          next_retry_at = NULL, duration_ms = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
          .bind(result.retryable ? "retry" : "blocked", result.publicMessage, result.code, result.internalMessage, Date.now() - started, job.jobId),
        env.DB.prepare("UPDATE analysis_requests SET status = 'blocked', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(job.requestId)
      ]);
      if (!result.retryable) {
        await env.DB.prepare(`UPDATE analysis_usage SET status = 'released', released_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP WHERE analysis_request_id = ? AND status = 'reserved'`).bind(job.requestId).run();
      }
      return;
    }

    await setStage(env.DB, job.jobId, "normalizing", "Building game timeline");
    const normalizedKey = `normalized/${job.game}/${job.publicId}/game-data.v1.json`;
    await env.BUCKET.put(normalizedKey, JSON.stringify(result.normalized), {
      httpMetadata: { contentType: "application/json" },
      customMetadata: { requestId: job.publicId, game: job.game, schemaVersion: result.normalized.schemaVersion }
    });

    await setStage(env.DB, job.jobId, "detecting", "Measuring repeated patterns");
    const matchResult = await env.DB.prepare(`INSERT INTO matches (
        public_id, analysis_request_id, player_id, game, ingestion_source, external_match_id, raw_object_key,
        normalized_object_key, mode, rank, game_version, occurred_at, parser_version, normalized_schema_version, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(analysis_request_id) DO UPDATE SET normalized_object_key = excluded.normalized_object_key,
        parser_version = excluded.parser_version, metadata_json = excluded.metadata_json
      RETURNING id`).bind(
        crypto.randomUUID().replaceAll("-", ""), job.requestId, job.playerId, job.game, result.normalized.source,
        result.normalized.externalMatchId ?? null, job.fileKey, normalizedKey, result.normalized.mode ?? null,
        result.normalized.rank ?? job.currentRank, result.normalized.gameVersion ?? null, result.normalized.occurredAt ?? null,
        result.versions.parser, result.normalized.schemaVersion, JSON.stringify(result.normalized.metadata)
      ).first<{ id: number }>();
    if (!matchResult) throw new Error("Could not persist the normalized match.");

    await env.DB.prepare("DELETE FROM analysis_findings WHERE analysis_request_id = ?").bind(job.requestId).run();
    for (let index = 0; index < result.findings.length; index += 1) {
      await persistFinding(env.DB, job, matchResult.id, result.findings[index], index + 1);
    }

    await setStage(env.DB, job.jobId, "coaching", "Prioritizing your coaching focus");
    const synthesis = await synthesizeCoaching(result.findings, env);
    const report = synthesis.report;
    const readyAt = new Date().toISOString();
    const durationMs = Date.now() - started;

    await setStage(env.DB, job.jobId, "persisting", "Saving your private report");
    const primaryFinding = await env.DB.prepare("SELECT id FROM analysis_findings WHERE analysis_request_id = ? ORDER BY priority ASC LIMIT 1")
      .bind(job.requestId).first<{ id: number }>();
    await env.DB.batch([
      env.DB.prepare(`UPDATE analysis_requests SET status = 'ready', highest_impact_mistake = ?, why_it_costs = ?,
        evidence_moments = ?, next_queue_rule = ?, practice_plan = ?, coach_note = ?, ready_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`).bind(
          report.highestImpactMistake, report.whyItCosts, report.evidenceMoments.join("\n"), report.nextQueueRule,
          report.practicePlan.join("\n"), report.coachNote, readyAt, job.requestId
        ),
      env.DB.prepare(`UPDATE analysis_jobs SET status = 'completed', stage = 'completed', stage_label = 'Report ready',
        parser_version = ?, analyzer_version = ?, detector_version = ?, coaching_version = ?, schema_version = ?,
        estimated_cost_micros = ?, duration_ms = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(result.versions.parser, result.versions.analyzer, result.versions.detector,
          `${result.versions.coaching}+${synthesis.model}`, result.versions.schema,
          result.estimatedCostMicros + synthesis.costMicros, durationMs, readyAt, job.jobId),
      env.DB.prepare(`UPDATE analysis_usage SET status = 'consumed', consumed_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE analysis_request_id = ? AND status = 'reserved'`).bind(readyAt, job.requestId)
    ]);

    if (job.playerId && primaryFinding) {
      await env.DB.batch([
        env.DB.prepare("UPDATE player_focuses SET status = 'replaced', updated_at = CURRENT_TIMESTAMP WHERE player_id = ? AND game = ? AND status = 'active'")
          .bind(job.playerId, job.game),
        env.DB.prepare(`INSERT INTO player_focuses (
          public_id, player_id, game, finding_id, status, title, success_metric, target_value, unit, matches_observed
        ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, 1)`)
          .bind(crypto.randomUUID().replaceAll("-", ""), job.playerId, job.game, primaryFinding.id,
            report.highestImpactMistake, result.findings[0].recommendation.successMetric ?? null,
            result.findings[0].recommendation.targetValue ?? null, result.findings[0].recommendation.targetUnit ?? null)
      ]);
    }

    try {
      const base = env.PUBLIC_SITE_URL || "https://replaymethod.xyz";
      await sendAnalysisReady({
        database: env.DB,
        analysisRequestId: job.requestId,
        analysisPublicId: job.publicId,
        email: job.email,
        game: job.game,
        url: reportUrl(base, job.publicId),
        mistake: report.highestImpactMistake,
      });
    } catch (error) {
      console.warn("analysis ready email failed", error);
    }
  } catch (error) {
    const detail = errorText(error);
    const retry = job.attempts < job.maxAttempts;
    await env.DB.batch([
      env.DB.prepare(`UPDATE analysis_jobs SET status = ?, stage = 'failed', stage_label = ?, error_code = 'analysis_pipeline_failed',
        error_message = ?, next_retry_at = ?, duration_ms = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(retry ? "retry" : "failed", retry ? "Retry scheduled" : "Analysis needs attention", detail,
          retry ? new Date(Date.now() + 60_000).toISOString() : null, Date.now() - started, job.jobId),
      env.DB.prepare("UPDATE analysis_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(retry ? "analyzing" : "failed", job.requestId)
    ]);
    if (!retry) {
      await env.DB.prepare(`UPDATE analysis_usage SET status = 'released', released_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP WHERE analysis_request_id = ? AND status = 'reserved'`).bind(job.requestId).run();
    }
    console.error("analysis job failed", { publicId, detail });
  }
}
