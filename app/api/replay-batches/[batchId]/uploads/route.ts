import { getDatabase } from "../../../../../db";
import { cleanText } from "../../../../../lib/analysis";
import { authorizedReplayBatch } from "../../../../../lib/replay-batch-access.mjs";
import { createReplayUploadToken, MAX_REPLAY_BYTES, REPLAY_CHUNK_BYTES, REPLAY_UPLOAD_TTL_MS, safeReplayFileName, sha256Hex } from "../../../../../lib/replay-upload.mjs";
import { declaredBodyTooLarge, isSameOriginRequest, operationalErrorCode } from "../../../../../lib/request-security.mjs";

export const runtime = "edge";
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ error: "Invalid replay upload request." }, { status: 403, headers });
    if (declaredBodyTooLarge(request, 4096) || request.headers.get("content-type")?.split(";", 1)[0] !== "application/json") {
      return Response.json({ error: "Start the replay upload with a small JSON request." }, { status: 415, headers });
    }
    const { batchId } = await params;
    const database = await getDatabase();
    const batch = await authorizedReplayBatch(database, request, batchId);
    if (!batch) return Response.json({ error: "Replay batch not found." }, { status: 404, headers });
    if (batch.status !== "collecting") return Response.json({ error: "This batch is no longer accepting replays." }, { status: 409, headers });
    if (Number(batch.validCount) >= Number(batch.targetCount)) return Response.json({ error: "All ten valid replay slots are already filled." }, { status: 409, headers });
    const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
    const fileName = safeReplayFileName(cleanText(payload.fileName, 240));
    const fileSize = Number(payload.fileSize);
    if (!fileName.toLowerCase().endsWith(".replay") || !Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > MAX_REPLAY_BYTES) {
      return Response.json({ error: "Upload an original Rocket League .replay file no larger than 16 MB." }, { status: 400, headers });
    }
    const recent = await database.prepare(`SELECT count(*) AS count FROM replay_batch_items
      WHERE batch_id = ? AND created_at >= datetime('now', '-1 hour')`).bind(batch.id).first<{ count: number }>();
    if (Number(recent?.count || 0) >= 30) {
      return Response.json({ error: "Too many replacement attempts. Wait an hour before adding another file." }, { status: 429, headers: { ...headers, "Retry-After": "3600" } });
    }
    const active = await database.prepare(`SELECT count(*) AS count FROM replay_batch_items
      WHERE batch_id = ? AND status IN ('uploading', 'processing')`).bind(batch.id).first<{ count: number }>();
    if (Number(active?.count || 0) >= 2) return Response.json({ error: "Finish the current replay before adding another." }, { status: 409, headers: { ...headers, "Retry-After": "2" } });

    const uploadId = crypto.randomUUID().replaceAll("-", "");
    const uploadToken = createReplayUploadToken();
    const expectedParts = Math.ceil(fileSize / REPLAY_CHUNK_BYTES);
    const expiresAt = new Date(Date.now() + REPLAY_UPLOAD_TTL_MS).toISOString();
    const inserted = await database.prepare(`INSERT INTO replay_upload_sessions (
        public_id, token_hash, email, file_name, file_size, chunk_size, expected_parts, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`)
      .bind(uploadId, await sha256Hex(uploadToken), batch.email, fileName, fileSize, REPLAY_CHUNK_BYTES, expectedParts, expiresAt)
      .first<{ id: number }>();
    if (!inserted) throw new Error("Could not create the replay upload.");
    const itemId = crypto.randomUUID().replaceAll("-", "");
    await database.prepare(`INSERT INTO replay_batch_items (
        public_id, batch_id, upload_session_id, job_public_id, file_name
      ) VALUES (?, ?, ?, ?, ?)`)
      .bind(itemId, batch.id, inserted.id, crypto.randomUUID().replaceAll("-", ""), fileName).run();
    return Response.json({ itemId, uploadId, uploadToken, chunkSize: REPLAY_CHUNK_BYTES, expectedParts, expiresAt }, { status: 201, headers });
  } catch (error) {
    console.error("batch replay upload initiation failed", { code: operationalErrorCode(error) });
    return Response.json({ error: "We couldn’t start this replay upload. The file is still on your device." }, { status: 500, headers });
  }
}
