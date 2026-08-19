export const PLAYER_SESSION_COOKIE = "__Host-rm_player_session";
export const PLAYER_SESSION_SECONDS = 90 * 24 * 60 * 60;
export const PLAYER_CLAIM_SECONDS = 7 * 24 * 60 * 60;
export const playerTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function createPlayerToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export async function hashPlayerToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function expiresAt(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export function readCookie(header, name) {
  if (!header) return "";
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1 || part.slice(0, separator).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(separator + 1).trim()); } catch { return ""; }
  }
  return "";
}

export function playerSessionCookie(token) {
  return `${PLAYER_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${PLAYER_SESSION_SECONDS}`;
}
