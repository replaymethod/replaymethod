import { getDatabase } from "../../../../../db";
import { declaredBodyTooLarge, isSameOriginRequest, operationalErrorCode } from "../../../../../lib/request-security.mjs";
import { replayUploadToken, safeReplayFileName, sha256Hex } from "../../../../../lib/replay-upload.mjs";

export const runtime = "edge";

const headers = { "Cache-Control": "no-store" };
const ASSEMBLY_LEASE_SECONDS = 30;
type UploadRow = { id: number; tokenHash: string; fileName: string; fileSize: number; expectedParts: number; status: string; objectKey: string | null; expiresAt: string; updatedAt: string };
type PartRow = { partNumber: number; objectKey: string; byteSize: number; sha256: string };

async function readReplayParts(bucket: R2Bucket, parts: PartRow[]) {
  const loaded = new Array<Uint8Array>(parts.length);
  let nextIndex = 0;
  async function loadNext() {
    while (nextIndex < parts.length) {
      const index = nextIndex;
      nextIndex += 1;
      const part = parts[index];
      const object = await bucket.get(part.objectKey);
      if (!object) throw new Error("staged replay part missing");
      const bytes = new Uint8Array(await object.arrayBuffer());
      if (bytes.byteLength !== part.byteSize || await sha256Hex(bytes) !== part.sha256) throw new Error("staged replay part failed integrity check");
      loaded[index] = bytes;
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, parts.length) }, () => loadNext()));
  return loaded;
}

export async function POST(request: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  let sessionId: number | null = null;
  let assemblyToken: string | null = null;
  let finalObjectKey: string | null = null;
  try {
    if (!isSameOriginRequest(request)) return Response.json({ error: "Invalid replay upload request." }, { status: 403, headers });
    if (declaredBodyTooLarge(request, 1024) || request.headers.get("content-type")?.split(";", 1)[0] !== "application/json") {
      return Response.json({ error: "Complete the replay upload with a small JSON request." }, { status: 415, headers });
    }
    const { uploadId } = await params;
    const token = replayUploadToken(request);
    if (!/^[a-f0-9]{32}$/.test(uploadId) || !token) return Response.json({ error: "Replay upload not found." }, { status: 404, headers });
    const database = await getDatabase();
    const session = await database.prepare(`SELECT id, token_hash AS tokenHash, file_name AS fileName,
      file_size AS fileSize, expected_parts AS expectedParts, status, object_key AS objectKey, expires_at AS expiresAt,
      updated_at AS updatedAt
      FROM replay_upload_sessions WHERE public_id = ?`).bind(uploadId).first<UploadRow>();
    if (!session || session.tokenHash !== await sha256Hex(token)) return Response.json({ error: "Replay upload not found." }, { status: 404, headers });
    if (["complete", "submitting", "claimed"].includes(session.status) && session.objectKey) {
      return Response.json({ completed: true, fileSaved: true }, { headers });
    }
    if (new Date(session.expiresAt) <= new Date()) return Response.json({ error: "This replay upload expired. Start again; the file is still on your device." }, { status: 410, headers });
    if (session.status === "assembling") {
      const reclaimed = await database.prepare(`UPDATE replay_upload_sessions SET status = 'pending', error_code = 'assembly_interrupted',
        updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'assembling'
        AND updated_at <= datetime('now', ?)`)
        .bind(session.id, `-${ASSEMBLY_LEASE_SECONDS} seconds`).run();
      if (reclaimed.meta.changes) session.status = "pending";
    }
    if (session.status !== "pending") return Response.json({
      error: "Replay assembly is already in progress. Retry completion in a moment.",
      recovery: "assembly_in_progress",
      retryable: true,
    }, { status: 409, headers: { ...headers, "Retry-After": "2" } });

    const parts = await database.prepare(`SELECT part_number AS partNumber, object_key AS objectKey,
      byte_size AS byteSize, sha256 FROM replay_upload_parts WHERE upload_session_id = ? ORDER BY part_number`)
      .bind(session.id).all<PartRow>();
    const savedParts = parts.results || [];
    const totalBytes = savedParts.reduce((total, part) => total + part.byteSize, 0);
    if (savedParts.length !== session.expectedParts || totalBytes !== session.fileSize || savedParts.some((part, index) => part.partNumber !== index)) {
      return Response.json({
        error: "Some replay parts are missing. Retry the upload; confirmed parts will be reused.",
        recovery: "parts_missing",
        retryable: true,
      }, { status: 409, headers });
    }
    assemblyToken = `assembly:${crypto.randomUUID().replaceAll("-", "")}`;
    const claimed = await database.prepare(`UPDATE replay_upload_sessions SET status = 'assembling', error_code = ?,
      updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'`).bind(assemblyToken, session.id).run();
    if (!claimed.meta.changes) return Response.json({
      error: "Replay assembly is already in progress. Retry completion in a moment.",
      recovery: "assembly_in_progress",
      retryable: true,
    }, { status: 409, headers: { ...headers, "Retry-After": "2" } });
    sessionId = session.id;

    const { env } = await import("cloudflare:workers");
    const bucket = (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
    if (!bucket) throw new Error("R2 binding unavailable");
    const loadedParts = await readReplayParts(bucket, savedParts);
    const assembled = new Uint8Array(session.fileSize);
    let offset = 0;
    for (const bytes of loadedParts) {
      assembled.set(bytes, offset);
      offset += bytes.byteLength;
    }
    const fileSha256 = await sha256Hex(assembled);
    finalObjectKey = `analyses/${uploadId}/${safeReplayFileName(session.fileName)}`;
    await bucket.put(finalObjectKey, assembled, {
      httpMetadata: { contentType: "application/octet-stream" },
      customMetadata: { objectId: uploadId, evidenceType: "replay_file", sha256: fileSha256 },
    });
    const completed = await database.prepare(`UPDATE replay_upload_sessions SET status = 'complete', object_key = ?, file_sha256 = ?,
      completed_at = CURRENT_TIMESTAMP, error_code = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'assembling' AND error_code = ?`)
      .bind(finalObjectKey, fileSha256, session.id, assemblyToken).run();
    if (!completed.meta.changes) throw new Error("replay assembly lease was lost before commit");
    finalObjectKey = null;
    sessionId = null;
    assemblyToken = null;
    try {
      await bucket.delete(savedParts.map(part => part.objectKey));
      await database.prepare("DELETE FROM replay_upload_parts WHERE upload_session_id = ?").bind(session.id).run();
    } catch (cleanupError) {
      console.warn("replay upload staging cleanup deferred", { code: operationalErrorCode(cleanupError) });
    }
    return Response.json({ completed: true, fileSaved: true, sha256: fileSha256 }, { headers });
  } catch (error) {
    try {
      if (sessionId != null && assemblyToken) {
        const database = await getDatabase();
        const released = await database.prepare(`UPDATE replay_upload_sessions SET status = 'pending', error_code = 'assembly_failed',
          updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'assembling' AND error_code = ?`).bind(sessionId, assemblyToken).run();
        if (released.meta.changes && finalObjectKey) {
          const { env } = await import("cloudflare:workers");
          await (env as unknown as { BUCKET?: R2Bucket }).BUCKET?.delete(finalObjectKey);
        }
      }
    } catch { /* best-effort recovery */ }
    console.error("replay upload completion failed", { code: operationalErrorCode(error) });
    return Response.json({
      error: "Your replay parts were saved, but final assembly did not finish. Retry; the saved parts and upload session will be reused.",
      recovery: "assembly_failed",
      retryable: true,
    }, { status: 500, headers: { ...headers, "Retry-After": "1" } });
  }
}
