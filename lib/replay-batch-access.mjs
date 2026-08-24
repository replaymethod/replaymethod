import { authenticatedPlayer } from "./player-session";
import { playerTokenPattern, hashPlayerToken } from "./player-identity.mjs";

export function replayBatchToken(request) {
  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
  return bearer || (request.headers.get("x-batch-access") || "").trim();
}

export async function authorizedReplayBatch(database, request, publicId) {
  if (!/^[a-f0-9]{32}$/.test(publicId)) return null;
  const token = replayBatchToken(request);
  const row = await database.prepare(`SELECT id, public_id AS publicId, token_hash AS tokenHash,
      analysis_request_id AS analysisRequestId, player_id AS playerId, email, status,
      target_count AS targetCount, valid_count AS validCount, excluded_count AS excludedCount,
      subject_player_id AS subjectPlayerId, subject_display_name AS subjectDisplayName,
      playlist, current_rank AS currentRank, goal, reporting_scope AS reportingScope,
      aggregation_version AS aggregationVersion, confidence_label AS confidenceLabel,
      created_at AS createdAt, updated_at AS updatedAt
    FROM replay_batches WHERE public_id = ? LIMIT 1`).bind(publicId).first();
  if (!row) return null;
  if (playerTokenPattern.test(token) && row.tokenHash === await hashPlayerToken(token)) return row;
  const player = await authenticatedPlayer(request, database);
  return player?.id === Number(row.playerId) ? row : null;
}
