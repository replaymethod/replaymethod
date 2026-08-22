import { getDatabase } from "../../../db";
import { cleanText, emailPattern } from "../../../lib/analysis";
import { declaredBodyTooLarge, isSameOriginRequest, operationalErrorCode } from "../../../lib/request-security.mjs";
import { createReplayUploadToken, MAX_REPLAY_BYTES, REPLAY_CHUNK_BYTES, REPLAY_UPLOAD_TTL_MS, safeReplayFileName, sha256Hex } from "../../../lib/replay-upload.mjs";
import { subsystemEnabled } from "../../../lib/subsystem-controls.mjs";

export const runtime = "edge";

const headers = { "Cache-Control": "no-store" };

async function cleanupExpired(database: D1Database, bucket: R2Bucket) {
  const expired = await database.prepare(`SELECT id, object_key AS objectKey FROM replay_upload_sessions
    WHERE expires_at <= CURRENT_TIMESTAMP AND status NOT IN ('claimed') ORDER BY expires_at LIMIT 3`).all<{ id: number; objectKey: string | null }>();
  for (const session of expired.results || []) {
    const parts = await database.prepare("SELECT object_key AS objectKey FROM replay_upload_parts WHERE upload_session_id = ?")
      .bind(session.id).all<{ objectKey: string }>();
    const keys = [...(parts.results || []).map(part => part.objectKey), session.objectKey].filter((key): key is string => Boolean(key));
    if (keys.length) await bucket.delete(keys);
    await database.batch([
      database.prepare("DELETE FROM replay_upload_parts WHERE upload_session_id = ?").bind(session.id),
      database.prepare("DELETE FROM replay_upload_sessions WHERE id = ? AND status NOT IN ('claimed')").bind(session.id),
    ]);
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ error: "Invalid replay upload request." }, { status: 403, headers });
    if (declaredBodyTooLarge(request, 4096) || request.headers.get("content-type")?.split(";", 1)[0] !== "application/json") {
      return Response.json({ error: "Start the replay upload with a small JSON request." }, { status: 415, headers });
    }
    const { env } = await import("cloudflare:workers");
    const runtime = env as unknown as { BUCKET?: R2Bucket; RL_ENGINE_ENABLED?: string };
    if (!subsystemEnabled(runtime.RL_ENGINE_ENABLED)) {
      return Response.json({ error: "Rocket League replay processing is temporarily paused. Your file was not uploaded." }, { status: 503, headers: { ...headers, "Retry-After": "3600" } });
    }
    if (!runtime.BUCKET) return Response.json({ error: "Replay uploads are temporarily unavailable. Your file was not uploaded." }, { status: 503, headers });

    const payload = await request.json().catch(() => ({})) as { email?: unknown; fileName?: unknown; fileSize?: unknown; dataConsent?: unknown };
    const email = cleanText(payload.email, 254).toLowerCase();
    const fileName = safeReplayFileName(cleanText(payload.fileName, 240));
    const fileSize = Number(payload.fileSize);
    if (!emailPattern.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400, headers });
    if (payload.dataConsent !== true) return Response.json({ error: "Confirm that we may process the submitted replay." }, { status: 400, headers });
    if (!fileName.toLowerCase().endsWith(".replay") || !Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > MAX_REPLAY_BYTES) {
      return Response.json({ error: "Upload a Rocket League .replay file no larger than 16 MB." }, { status: 400, headers });
    }

    const database = await getDatabase();
    await cleanupExpired(database, runtime.BUCKET);
    const recent = await database.prepare(`SELECT count(*) AS count FROM replay_upload_sessions
      WHERE email = ? AND created_at >= datetime('now', '-1 hour')`).bind(email).first<{ count: number }>();
    if (Number(recent?.count || 0) >= 10) {
      return Response.json({ error: "Too many replay upload attempts. Wait an hour before starting another." }, { status: 429, headers: { ...headers, "Retry-After": "3600" } });
    }

    const uploadId = crypto.randomUUID().replaceAll("-", "");
    const uploadToken = createReplayUploadToken();
    const expectedParts = Math.ceil(fileSize / REPLAY_CHUNK_BYTES);
    const expiresAt = new Date(Date.now() + REPLAY_UPLOAD_TTL_MS).toISOString();
    await database.prepare(`INSERT INTO replay_upload_sessions (
      public_id, token_hash, email, file_name, file_size, chunk_size, expected_parts, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(uploadId, await sha256Hex(uploadToken), email, fileName, fileSize, REPLAY_CHUNK_BYTES, expectedParts, expiresAt).run();
    return Response.json({ uploadId, uploadToken, chunkSize: REPLAY_CHUNK_BYTES, expectedParts, expiresAt }, { status: 201, headers });
  } catch (error) {
    console.error("replay upload initiation failed", { code: operationalErrorCode(error) });
    return Response.json({ error: "We couldn’t start the replay upload. The file is still on your device—try again." }, { status: 500, headers });
  }
}
