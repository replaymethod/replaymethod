import { inArray } from "drizzle-orm";
import { getDb } from "../../../../db";
import { analysisRequests } from "../../../../db/schema";
import { gameLabels, isAnalysisGame, publicIdPattern } from "../../../../lib/analysis";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { ids?: unknown[] };
    const ids = (payload.ids || []).filter((id): id is string => typeof id === "string" && publicIdPattern.test(id)).slice(0, 20);
    if (!ids.length) return Response.json({ reports: [] });
    const db = await getDb();
    const rows = await db.select({
      publicId: analysisRequests.publicId,
      game: analysisRequests.game,
      currentRank: analysisRequests.currentRank,
      targetRank: analysisRequests.targetRank,
      status: analysisRequests.status,
      createdAt: analysisRequests.createdAt,
      highestImpactMistake: analysisRequests.highestImpactMistake
    }).from(analysisRequests).where(inArray(analysisRequests.publicId, ids));
    return Response.json({ reports: rows.filter(row => isAnalysisGame(row.game)).map(row => ({ ...row, gameLabel: gameLabels[row.game as keyof typeof gameLabels] })) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ reports: [] });
  }
}
