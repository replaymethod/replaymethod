import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../../../../db";
import { analysisRequests, playerClaims, playerSessions } from "../../../../db/schema";
import { createPlayerToken, expiresAt, hashPlayerToken, playerSessionCookie, PLAYER_SESSION_SECONDS, playerTokenPattern } from "../../../../lib/player-identity.mjs";

export const runtime = "edge";

function accessRedirect(request: Request, token: string, state: string) {
  return Response.redirect(new URL(`/access/${token}?state=${state}`, request.url), 303);
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid ownership request." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const form = await request.formData();
  const token = typeof form.get("token") === "string" ? String(form.get("token")) : "";
  if (!playerTokenPattern.test(token)) return accessRedirect(request, token, "invalid");

  const db = await getDb();
  const claim = await db.select({
    id: playerClaims.id,
    playerId: playerClaims.playerId,
    expiresAt: playerClaims.expiresAt,
    consumedAt: playerClaims.consumedAt,
    reportPublicId: analysisRequests.publicId
  }).from(playerClaims).innerJoin(analysisRequests, eq(analysisRequests.id, playerClaims.analysisRequestId))
    .where(eq(playerClaims.tokenHash, await hashPlayerToken(token))).get();

  if (!claim || claim.consumedAt || new Date(claim.expiresAt).getTime() <= Date.now()) {
    return accessRedirect(request, token, "expired");
  }

  const now = new Date().toISOString();
  const consumed = await db.update(playerClaims).set({ consumedAt: now })
    .where(and(eq(playerClaims.id, claim.id), isNull(playerClaims.consumedAt)))
    .returning({ id: playerClaims.id }).get();
  if (!consumed) return accessRedirect(request, token, "expired");

  const sessionToken = createPlayerToken();
  await db.insert(playerSessions).values({
    tokenHash: await hashPlayerToken(sessionToken),
    playerId: claim.playerId,
    expiresAt: expiresAt(PLAYER_SESSION_SECONDS),
    lastSeenAt: now
  });

  const response = Response.redirect(new URL(`/report/${claim.reportPublicId}?ownership=verified`, request.url), 303);
  response.headers.set("Set-Cookie", playerSessionCookie(sessionToken));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
