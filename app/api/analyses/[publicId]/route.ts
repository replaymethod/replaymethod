import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { analysisJobs, analysisRequests } from "../../../../db/schema";
import { publicIdPattern } from "../../../../lib/analysis";
import { loadPublicReport } from "../../../../lib/report-data";
import { decodePlayerResolutionContext } from "../../../../lib/player-resolution.mjs";
import { declaredBodyTooLarge, isSameOriginRequest } from "../../../../lib/request-security.mjs";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const report = await loadPublicReport(publicId);
  if (!report) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(report, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Invalid player-selection request." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  if (declaredBodyTooLarge(request, 2048) || request.headers.get("content-type")?.split(";", 1)[0] !== "application/json") {
    return Response.json({ error: "Submit one replay player as JSON." }, { status: 415, headers: { "Cache-Control": "no-store" } });
  }
  const { publicId } = await params;
  if (!publicIdPattern.test(publicId)) return Response.json({ error: "Not found" }, { status: 404 });

  let selectedPlayer = "";
  let selectedRank = "";
  try {
    const body = await request.json() as { player?: unknown; rank?: unknown };
    selectedPlayer = typeof body.player === "string" ? body.player.trim() : "";
    selectedRank = typeof body.rank === "string" ? body.rank.trim().slice(0, 80) : "";
  } catch {
    return Response.json({ error: "Choose one identified player." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const db = await getDb();
  const analysis = await db.select().from(analysisRequests).where(eq(analysisRequests.publicId, publicId)).get();
  if (!analysis) return Response.json({ error: "Not found" }, { status: 404 });
  const job = await db.select().from(analysisJobs).where(eq(analysisJobs.analysisRequestId, analysis.id)).get();
  const resolvableCode = ["subject_player_required", "subject_player_not_found", "subject_player_ambiguous"].includes(job?.errorCode || "");
  const candidates = decodePlayerResolutionContext(job?.errorMessage).candidatePlayers;
  const canonicalPlayer = candidates.find(candidate => candidate.localeCompare(selectedPlayer, undefined, { sensitivity: "accent" }) === 0);
  if (!job || !analysis.fileKey || !resolvableCode || !["blocked", "failed"].includes(job.status) || !canonicalPlayer || selectedRank.length < 2) {
    return Response.json({ error: "This saved replay cannot be retried with that player." }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }

  const now = new Date().toISOString();
  await db.batch([
    db.update(analysisRequests).set({ playerContext: canonicalPlayer, currentRank: selectedRank, status: "received", updatedAt: now }).where(eq(analysisRequests.id, analysis.id)),
    db.update(analysisJobs).set({
      status: "queued",
      stage: "queued",
      stageLabel: "Player selected · replay preserved",
      attempts: 0,
      errorCode: null,
      errorMessage: null,
      durationMs: null,
      startedAt: null,
      completedAt: null,
      nextRetryAt: null,
      updatedAt: now,
    }).where(eq(analysisJobs.id, job.id)),
  ]);
  return Response.json({ queued: true, jobPublicId: job.publicId }, { headers: { "Cache-Control": "no-store" } });
}
