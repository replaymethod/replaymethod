import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "../../../../db";
import { analysisJobs, analysisRequests, playerSessions } from "../../../../db/schema";
import { gameLabels, isAnalysisGame, publicIdPattern } from "../../../../lib/analysis";
import { hashPlayerToken, PLAYER_SESSION_COOKIE, playerTokenPattern, readCookie } from "../../../../lib/player-identity.mjs";
import { isSameOriginRequest } from "../../../../lib/request-security.mjs";

const fields = {
  publicId: analysisRequests.publicId,
  game: analysisRequests.game,
  currentRank: analysisRequests.currentRank,
  targetRank: analysisRequests.targetRank,
  status: analysisRequests.status,
  createdAt: analysisRequests.createdAt,
  highestImpactMistake: analysisRequests.highestImpactMistake
};

type ReportRow = {
  publicId: string;
  game: string;
  currentRank: string;
  targetRank: string | null;
  status: string;
  createdAt: string;
  highestImpactMistake: string | null;
};

function summaries(rows: ReportRow[]) {
  return rows.filter(row => isAnalysisGame(row.game)).map(row => ({ ...row, gameLabel: gameLabels[row.game as keyof typeof gameLabels] }));
}

export async function GET(request: Request) {
  try {
    const token = readCookie(request.headers.get("cookie"), PLAYER_SESSION_COOKIE);
    if (!playerTokenPattern.test(token)) return Response.json({ reports: [], authenticated: false }, { headers: { "Cache-Control": "no-store" } });
    const db = await getDb();
    const session = await db.select().from(playerSessions).where(and(
      eq(playerSessions.tokenHash, await hashPlayerToken(token)),
      isNull(playerSessions.revokedAt)
    )).get();
    if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
      return Response.json({ reports: [], authenticated: false }, { headers: { "Cache-Control": "no-store" } });
    }
    const rows = await db.select(fields).from(analysisRequests)
      .innerJoin(analysisJobs, eq(analysisJobs.analysisRequestId, analysisRequests.id))
      .where(eq(analysisJobs.playerId, session.playerId))
      .orderBy(desc(analysisRequests.createdAt)).limit(20);
    await db.update(playerSessions).set({ lastSeenAt: new Date().toISOString() }).where(eq(playerSessions.id, session.id));
    return Response.json({ reports: summaries(rows), authenticated: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ reports: [], authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return Response.json({ reports: [] }, { status: 403, headers: { "Cache-Control": "no-store" } });
    const payload = await request.json() as { ids?: unknown[] };
    const ids = (payload.ids || []).filter((id): id is string => typeof id === "string" && publicIdPattern.test(id)).slice(0, 20);
    if (!ids.length) return Response.json({ reports: [] });
    const db = await getDb();
    const rows = await db.select(fields).from(analysisRequests).where(inArray(analysisRequests.publicId, ids));
    return Response.json({ reports: summaries(rows), authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ reports: [] });
  }
}
