import { getDatabase } from "../../../../db";
import { cleanText } from "../../../../lib/analysis";
import { authorizedReplayBatch } from "../../../../lib/replay-batch-access.mjs";
import { declaredBodyTooLarge, isSameOriginRequest } from "../../../../lib/request-security.mjs";

export const runtime = "edge";
const headers = { "Cache-Control": "no-store" };

async function snapshot(database: D1Database, batch: Record<string, unknown>) {
  const items = await database.prepare(`SELECT public_id AS itemId, status, valid_slot AS validSlot,
      file_name AS fileName, playlist, occurred_at AS occurredAt, candidate_players_json AS candidatePlayersJson,
      error_code AS errorCode, error_message AS errorMessage, attempts
    FROM replay_batch_items WHERE batch_id = ? ORDER BY id`).bind(batch.id).all<Record<string, unknown>>();
  return {
    batchId: batch.publicId,
    status: batch.status,
    validCount: Number(batch.validCount),
    targetCount: Number(batch.targetCount),
    excludedCount: Number(batch.excludedCount),
    subjectDisplayName: batch.subjectDisplayName || null,
    playlist: batch.playlist || null,
    currentRank: batch.currentRank || null,
    confidenceLabel: batch.confidenceLabel || null,
    reportUrl: `/report/${batch.publicId}`,
    items: (items.results || []).map(item => ({
      itemId: item.itemId,
      status: item.status,
      validSlot: item.validSlot == null ? null : Number(item.validSlot),
      fileName: item.fileName,
      playlist: item.playlist,
      occurredAt: item.occurredAt,
      candidatePlayers: (() => { try { const value = JSON.parse(String(item.candidatePlayersJson || "[]")); return Array.isArray(value) ? value : []; } catch { return []; } })(),
      errorCode: item.errorCode,
      errorMessage: item.errorMessage,
      attempts: Number(item.attempts),
    })),
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const database = await getDatabase();
  const batch = await authorizedReplayBatch(database, request, batchId);
  if (!batch) return Response.json({ error: "Replay batch not found." }, { status: 404, headers });
  return Response.json(await snapshot(database, batch), { headers });
}

export async function POST(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "Invalid replay batch request." }, { status: 403, headers });
  if (declaredBodyTooLarge(request, 4096) || request.headers.get("content-type")?.split(";", 1)[0] !== "application/json") {
    return Response.json({ error: "Update the batch with a small JSON request." }, { status: 415, headers });
  }
  const { batchId } = await params;
  const database = await getDatabase();
  const batch = await authorizedReplayBatch(database, request, batchId);
  if (!batch) return Response.json({ error: "Replay batch not found." }, { status: 404, headers });
  const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
  if (payload.action !== "choose_player") return Response.json({ error: "Unsupported batch action." }, { status: 400, headers });
  const player = cleanText(payload.player, 160);
  const rank = cleanText(payload.rank, 80);
  const awaiting = await database.prepare(`SELECT id, candidate_players_json AS candidatePlayersJson
    FROM replay_batch_items WHERE batch_id = ? AND status = 'awaiting_player' ORDER BY id LIMIT 1`)
    .bind(batch.id).first<{ id: number; candidatePlayersJson: string | null }>();
  let candidates: string[] = [];
  try { candidates = JSON.parse(awaiting?.candidatePlayersJson || "[]"); } catch { /* fail closed */ }
  if (!awaiting || !candidates.includes(player)) return Response.json({ error: "Choose an exact player found in the replay." }, { status: 400, headers });
  if (!rank) return Response.json({ error: "Choose the current rank for this playlist." }, { status: 400, headers });
  await database.batch([
    database.prepare(`UPDATE replay_batches SET subject_display_name = ?, current_rank = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(player, rank, batch.id),
    database.prepare(`UPDATE analysis_requests SET player_context = ?, current_rank = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(player, rank, batch.analysisRequestId),
    database.prepare(`UPDATE replay_batch_items SET status = 'uploaded', job_public_id = ?, candidate_players_json = NULL,
      error_code = NULL, error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'awaiting_player'`)
      .bind(crypto.randomUUID().replaceAll("-", ""), awaiting.id),
  ]);
  const updated = await authorizedReplayBatch(database, request, batchId);
  return Response.json(await snapshot(database, updated || batch), { headers });
}
