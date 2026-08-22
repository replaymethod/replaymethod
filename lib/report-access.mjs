import { hashPlayerToken, PLAYER_SESSION_COOKIE, playerTokenPattern, readCookie } from "./player-identity.mjs";

export const REPORT_ACCESS_SECONDS = 7 * 24 * 60 * 60;

export function reportAccessToken(request) {
  const header = (request.headers.get("x-report-access") || "").trim();
  if (header) return header;
  try { return new URL(request.url).searchParams.get("access") || ""; } catch { return ""; }
}

export async function canAccessAnalysis(database, publicId, token = "", cookieHeader = "") {
  const reportHash = playerTokenPattern.test(token) ? await hashPlayerToken(token) : "";
  const sessionToken = readCookie(cookieHeader, PLAYER_SESSION_COOKIE);
  const sessionHash = playerTokenPattern.test(sessionToken) ? await hashPlayerToken(sessionToken) : "";
  const row = await database.prepare(`SELECT r.id FROM analysis_requests r
    JOIN analysis_jobs j ON j.analysis_request_id = r.id
    WHERE r.public_id = ? AND (
      EXISTS (SELECT 1 FROM analysis_report_access a WHERE a.analysis_request_id = r.id AND a.token_hash = ? AND a.expires_at > ?)
      OR EXISTS (SELECT 1 FROM player_sessions s WHERE s.player_id = j.player_id AND s.token_hash = ?
        AND s.revoked_at IS NULL AND s.expires_at > ?)
    ) LIMIT 1`).bind(publicId, reportHash, new Date().toISOString(), sessionHash, new Date().toISOString()).first();
  return Boolean(row);
}
