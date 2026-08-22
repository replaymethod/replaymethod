export const MAX_REPLAY_BYTES = 16 * 1024 * 1024;
export const REPLAY_CHUNK_BYTES = 512 * 1024;
export const MAX_REPLAY_PARTS = MAX_REPLAY_BYTES / REPLAY_CHUNK_BYTES;
export const REPLAY_UPLOAD_TTL_MS = 2 * 60 * 60 * 1000;

export function safeReplayFileName(value) {
  return String(value || "").replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || "match.replay";
}

export function replayUploadToken(request) {
  const authorization = request.headers.get("authorization") || "";
  if (authorization.startsWith("Bearer ")) return authorization.slice(7).trim();
  return (request.headers.get("x-replay-upload-token") || "").trim();
}

export async function sha256Hex(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function createReplayUploadToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function expectedReplayPartSize(fileSize, partNumber, chunkSize = REPLAY_CHUNK_BYTES) {
  const offset = partNumber * chunkSize;
  return Math.max(0, Math.min(chunkSize, fileSize - offset));
}
