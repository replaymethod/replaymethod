import { getDatabase } from "../db";
import { hashPlayerToken, PLAYER_SESSION_COOKIE, playerTokenPattern, readCookie } from "./player-identity.mjs";
import { isSameOriginRequest } from "./request-security.mjs";

export type AuthenticatedPlayer = {
  id: number;
  publicId: string;
  email: string;
};

export async function authenticatedPlayer(request: Request, database?: D1Database): Promise<AuthenticatedPlayer | null> {
  const token = readCookie(request.headers.get("cookie"), PLAYER_SESSION_COOKIE);
  if (!playerTokenPattern.test(token)) return null;
  const db = database || await getDatabase();
  const player = await db.prepare(`SELECT p.id, p.public_id, p.email
    FROM player_sessions s
    JOIN players p ON p.id = s.player_id
    WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?
    LIMIT 1`).bind(await hashPlayerToken(token), new Date().toISOString()).first<Record<string, unknown>>();
  if (!player) return null;
  await db.prepare("UPDATE player_sessions SET last_seen_at = ? WHERE token_hash = ?")
    .bind(new Date().toISOString(), await hashPlayerToken(token)).run();
  return { id: Number(player.id), publicId: String(player.public_id), email: String(player.email) };
}

export function isSameOrigin(request: Request) {
  return isSameOriginRequest(request);
}
