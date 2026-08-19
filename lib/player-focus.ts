import type { GameId, StructuredFinding } from "./core/contracts";
import { explicitProgressMetric, progressState, supportedFocusFinding } from "./focus-policy.mjs";

export type PersistedFocusFinding = {
  finding: StructuredFinding;
  findingId: number;
};

type ActiveFocus = {
  id: number;
  detectorId: string;
  metricKey: string | null;
  baselineValue: number | null;
  latestValue: number | null;
  targetValue: number | null;
  targetDirection: string | null;
  minimumMatches: number;
  matchesObserved: number;
};

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function createFocus(
  db: D1Database,
  playerId: number,
  game: GameId,
  analysisRequestId: number,
  source: PersistedFocusFinding,
) {
  const metric = explicitProgressMetric(source.finding);
  const inserted = await db.prepare(`INSERT INTO player_focuses (
      public_id, player_id, game, finding_id, detector_id, baseline_analysis_request_id,
      latest_analysis_request_id, status, title, success_metric, metric_key, metric_label,
      baseline_value, latest_value, target_value, unit, target_direction, minimum_matches,
      matches_observed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    RETURNING id`).bind(
      crypto.randomUUID().replaceAll("-", ""), playerId, game, source.findingId, source.finding.id,
      analysisRequestId, analysisRequestId, source.finding.title, source.finding.recommendation.successMetric ?? null,
      metric?.key ?? null, metric?.label ?? null, metric?.value ?? null, metric?.value ?? null,
      metric?.target ?? null, metric?.unit ?? null, metric?.direction ?? null, metric?.minimumMatches ?? 3,
    ).first<{ id: number }>();
  if (!inserted) throw new Error("Could not persist the active player focus.");
  await insertObservation(db, inserted.id, analysisRequestId, source, metric?.value ?? null, metric?.key ?? null, metric?.label ?? null, metric?.unit ?? null);
  return inserted.id;
}

async function insertObservation(
  db: D1Database,
  focusId: number,
  analysisRequestId: number,
  source: PersistedFocusFinding,
  metricValue: number | null,
  metricKey: string | null,
  metricLabel: string | null,
  unit: string | null,
) {
  return db.prepare(`INSERT OR IGNORE INTO player_focus_observations (
      public_id, focus_id, analysis_request_id, finding_id, detector_id, confidence,
      metric_key, metric_label, metric_value, unit, recurrence_value, evidence_json, limitations_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      crypto.randomUUID().replaceAll("-", ""), focusId, analysisRequestId, source.findingId,
      source.finding.id, source.finding.confidence, metricKey, metricLabel, metricValue, unit,
      finite(source.finding.frequency), JSON.stringify(source.finding.evidence.slice(0, 5)),
      JSON.stringify(source.finding.limitations.slice(0, 8)),
    ).run();
}

function currentMetric(focus: ActiveFocus, finding: StructuredFinding) {
  if (!focus.metricKey) return null;
  const metric = finding.metrics.find(candidate => candidate.key === focus.metricKey && Number.isFinite(candidate.value));
  return metric ? { value: metric.value, label: metric.label, unit: metric.unit || null } : null;
}

export async function advancePlayerFocus(input: {
  db: D1Database;
  playerId: number;
  game: GameId;
  analysisRequestId: number;
  findings: PersistedFocusFinding[];
}) {
  const supported = input.findings.filter(item => supportedFocusFinding(item.finding));
  if (!supported.length) return { state: "abstained", reason: "no_supported_finding" } as const;

  const active = await input.db.prepare(`SELECT id, detector_id AS detectorId, metric_key AS metricKey,
      baseline_value AS baselineValue, latest_value AS latestValue, target_value AS targetValue,
      target_direction AS targetDirection, minimum_matches AS minimumMatches,
      matches_observed AS matchesObserved
    FROM player_focuses WHERE player_id = ? AND game = ? AND status = 'active' LIMIT 1`)
    .bind(input.playerId, input.game).first<ActiveFocus>();

  if (!active) {
    const focusId = await createFocus(input.db, input.playerId, input.game, input.analysisRequestId, supported[0]);
    return { state: "created", focusId, detectorId: supported[0].finding.id } as const;
  }

  const observed = supported.find(item => item.finding.id === active.detectorId);
  if (!observed) {
    return { state: "abstained", reason: "active_focus_not_observed", focusId: active.id } as const;
  }

  const metric = currentMetric(active, observed.finding);
  const observation = await insertObservation(
    input.db, active.id, input.analysisRequestId, observed,
    metric?.value ?? null, active.metricKey, metric?.label ?? null, metric?.unit ?? null,
  );
  if (!observation.meta.changes) return { state: "unchanged", reason: "analysis_already_observed", focusId: active.id } as const;

  const matchesObserved = active.matchesObserved + 1;
  const latestValue = metric?.value ?? active.latestValue;
  await input.db.prepare(`UPDATE player_focuses SET finding_id = ?, latest_analysis_request_id = ?,
      title = ?, success_metric = ?, latest_value = ?, matches_observed = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'active'`).bind(
      observed.findingId, input.analysisRequestId, observed.finding.title,
      observed.finding.recommendation.successMetric ?? null, latestValue, matchesObserved, active.id,
    ).run();

  const progress = progressState({
    baseline: active.baselineValue,
    latest: latestValue,
    target: active.targetValue,
    direction: active.targetDirection,
    matchesObserved,
    minimumMatches: active.minimumMatches,
  });
  if (progress !== "target_met") {
    return { state: "observed", focusId: active.id, matchesObserved, progress } as const;
  }

  const now = new Date().toISOString();
  await input.db.prepare(`UPDATE player_focuses SET status = 'completed', completed_at = ?,
    completion_reason = 'target_met', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'active'`)
    .bind(now, active.id).run();
  const next = supported.find(item => item.finding.id !== active.detectorId);
  if (!next) return { state: "completed", focusId: active.id, matchesObserved, progress } as const;
  const nextFocusId = await createFocus(input.db, input.playerId, input.game, input.analysisRequestId, next);
  return { state: "advanced", focusId: nextFocusId, completedFocusId: active.id, detectorId: next.finding.id } as const;
}

export async function loadPlayerFocusState(db: D1Database, playerId: number, game: GameId) {
  const active = await db.prepare(`SELECT id, public_id AS publicId, detector_id AS detectorId, title, success_metric AS successMetric,
      metric_key AS metricKey, metric_label AS metricLabel, baseline_value AS baselineValue,
      latest_value AS latestValue, target_value AS targetValue, unit, target_direction AS targetDirection,
      minimum_matches AS minimumMatches, matches_observed AS matchesObserved, assigned_at AS assignedAt
    FROM player_focuses WHERE player_id = ? AND game = ? AND status = 'active' LIMIT 1`)
    .bind(playerId, game).first<Record<string, unknown>>();
  const observations = active ? await db.prepare(`SELECT public_id AS publicId, analysis_request_id AS analysisRequestId,
      confidence, metric_key AS metricKey, metric_label AS metricLabel, metric_value AS metricValue,
      unit, recurrence_value AS recurrenceValue, evidence_json AS evidenceJson,
      limitations_json AS limitationsJson, observed_at AS observedAt
    FROM player_focus_observations WHERE focus_id = ? ORDER BY observed_at DESC LIMIT 12`)
    .bind(Number(active.id)).all<Record<string, unknown>>() : null;
  const history = await db.prepare(`SELECT public_id AS publicId, detector_id AS detectorId, title,
      completion_reason AS completionReason, matches_observed AS matchesObserved,
      assigned_at AS assignedAt, completed_at AS completedAt
    FROM player_focuses WHERE player_id = ? AND game = ? AND status != 'active'
    ORDER BY completed_at DESC, updated_at DESC LIMIT 12`).bind(playerId, game).all<Record<string, unknown>>();
  const activeWithProgress = active ? {
    ...active,
    progress: progressState({
      baseline: active.baselineValue,
      latest: active.latestValue,
      target: active.targetValue,
      direction: active.targetDirection,
      matchesObserved: Number(active.matchesObserved),
      minimumMatches: Number(active.minimumMatches),
    }),
  } : null;
  if (activeWithProgress) delete activeWithProgress.id;
  return { active: activeWithProgress, observations: observations?.results || [], history: history.results || [] };
}
