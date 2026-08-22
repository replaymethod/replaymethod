import { getDatabase } from "../../../../../../db";
import { declaredBodyTooLarge, isSameOriginRequest, operationalErrorCode } from "../../../../../../lib/request-security.mjs";
import { expectedReplayPartSize, replayUploadToken, sha256Hex } from "../../../../../../lib/replay-upload.mjs";

export const runtime = "edge";

const headers = { "Cache-Control": "no-store" };
type UploadRow = { id: number; tokenHash: string; fileSize: number; chunkSize: number; expectedParts: number; status: string; expiresAt: string };

export async function PUT(request: Request, { params }: { params: Promise<{ uploadId: string; partNumber: string }> }) {
  let loserObjectKey: string | null = null;
  try {
    if (!isSameOriginRequest(request)) return Response.json({ error: "Invalid replay upload request." }, { status: 403, headers });
    if (request.headers.get("content-type")?.split(";", 1)[0] !== "application/octet-stream") {
      return Response.json({ error: "Upload replay parts as binary data." }, { status: 415, headers });
    }
    const { uploadId, partNumber: rawPartNumber } = await params;
    const partNumber = Number(rawPartNumber);
    if (!/^[a-f0-9]{32}$/.test(uploadId) || !Number.isSafeInteger(partNumber) || partNumber < 0) {
      return Response.json({ error: "Replay upload not found." }, { status: 404, headers });
    }
    const token = replayUploadToken(request);
    if (!token) return Response.json({ error: "Replay upload authorization is missing." }, { status: 401, headers });

    const database = await getDatabase();
    const session = await database.prepare(`SELECT id, token_hash AS tokenHash, file_size AS fileSize,
      chunk_size AS chunkSize, expected_parts AS expectedParts, status, expires_at AS expiresAt
      FROM replay_upload_sessions WHERE public_id = ?`).bind(uploadId).first<UploadRow>();
    if (!session || session.tokenHash !== await sha256Hex(token)) return Response.json({ error: "Replay upload not found." }, { status: 404, headers });
    if (new Date(session.expiresAt) <= new Date()) return Response.json({ error: "This replay upload expired. Start again; the file is still on your device." }, { status: 410, headers });
    if (session.status !== "pending" || partNumber >= session.expectedParts) {
      return Response.json({ error: "This replay upload cannot accept that part." }, { status: 409, headers });
    }
    const expectedSize = expectedReplayPartSize(session.fileSize, partNumber, session.chunkSize);
    if (declaredBodyTooLarge(request, expectedSize)) return Response.json({ error: "That replay part is larger than expected." }, { status: 413, headers });
    const body = await request.arrayBuffer();
    if (body.byteLength !== expectedSize) return Response.json({ error: "That replay part is incomplete. Retry the same part." }, { status: 400, headers });

    const sha256 = await sha256Hex(body);
    const objectKey = `replay-staging/${session.id}/${partNumber}-${sha256}`;
    const { env } = await import("cloudflare:workers");
    const bucket = (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
    if (!bucket) return Response.json({ error: "Replay storage is temporarily unavailable. Retry this part." }, { status: 503, headers });
    await bucket.put(objectKey, body, { httpMetadata: { contentType: "application/octet-stream" }, customMetadata: { sha256 } });
    loserObjectKey = objectKey;
    await database.prepare(`INSERT OR IGNORE INTO replay_upload_parts (
      upload_session_id, part_number, object_key, byte_size, sha256
    ) VALUES (?, ?, ?, ?, ?)`)
      .bind(session.id, partNumber, objectKey, body.byteLength, sha256).run();
    const saved = await database.prepare(`SELECT object_key AS objectKey, byte_size AS byteSize, sha256
      FROM replay_upload_parts WHERE upload_session_id = ? AND part_number = ?`).bind(session.id, partNumber)
      .first<{ objectKey: string; byteSize: number; sha256: string }>();
    if (!saved || saved.byteSize !== body.byteLength || saved.sha256 !== sha256) {
      await bucket.delete(objectKey);
      return Response.json({ error: "That replay part conflicts with data already saved. Start a new upload." }, { status: 409, headers });
    }
    if (saved.objectKey !== objectKey) await bucket.delete(objectKey);
    loserObjectKey = null;
    return Response.json({ saved: true, partNumber, sha256 }, { headers });
  } catch (error) {
    if (loserObjectKey) {
      try {
        const { env } = await import("cloudflare:workers");
        await (env as unknown as { BUCKET?: R2Bucket }).BUCKET?.delete(loserObjectKey);
      } catch { /* best-effort cleanup */ }
    }
    console.error("replay upload part failed", { code: operationalErrorCode(error) });
    return Response.json({ error: "That replay part was not confirmed. Retry the same part; the file is still on your device." }, { status: 500, headers });
  }
}
