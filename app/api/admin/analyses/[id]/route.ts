import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { analysisJobs, analysisRequests } from "../../../../../db/schema";
import { requireSiteAdminApi } from "../../../../../lib/admin";
import { cleanText, isAnalysisGame, reportUrl, type AnalysisStatus } from "../../../../../lib/analysis";
import { sendAnalysisReady } from "../../../../../lib/email";

const statuses = new Set<AnalysisStatus>(["received", "analyzing", "blocked", "failed", "ready"]);
const lines = (value: unknown, limit: number) => cleanText(value, 5000).split("\n").map(line => line.trim()).filter(Boolean).slice(0, limit);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireSiteAdminApi();
  if (unauthorized) return unauthorized;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Invalid request" }, { status: 400 });

  try {
    const payload = await request.json() as Record<string, unknown>;
    const status = cleanText(payload.status, 20) as AnalysisStatus;
    if (!statuses.has(status)) return Response.json({ error: "Invalid status" }, { status: 400 });

    const db = await getDb();
    const existing = await db.select().from(analysisRequests).where(eq(analysisRequests.id, id)).get();
    if (!existing || !isAnalysisGame(existing.game)) return Response.json({ error: "Not found" }, { status: 404 });

    const highestImpactMistake = cleanText(payload.highestImpactMistake, 500) || null;
    const whyItCosts = cleanText(payload.whyItCosts, 1600) || null;
    const nextQueueRule = cleanText(payload.nextQueueRule, 700) || null;
    const coachNote = cleanText(payload.coachNote, 1600) || null;
    const evidenceMoments = lines(payload.evidenceMoments, 6);
    const practicePlan = lines(payload.practicePlan, 10);
    if (status === "ready" && (!highestImpactMistake || !whyItCosts || !nextQueueRule || evidenceMoments.length < 1 || practicePlan.length < 1)) {
      return Response.json({ error: "Complete the mistake, why it costs, evidence, next-queue rule and practice plan before publishing." }, { status: 400 });
    }

    const becomingReady = status === "ready" && existing.status !== "ready";
    const now = new Date().toISOString();
    await db.update(analysisRequests).set({
      status,
      highestImpactMistake,
      whyItCosts,
      evidenceMoments: JSON.stringify(evidenceMoments),
      nextQueueRule,
      practicePlan: JSON.stringify(practicePlan),
      coachNote,
      updatedAt: now,
      readyAt: becomingReady ? now : existing.readyAt
    }).where(eq(analysisRequests.id, id));

    if (becomingReady) {
      await db.update(analysisJobs).set({
        status: "completed",
        stage: "completed",
        stageLabel: "Quality-reviewed report ready",
        coachingVersion: "quality-review",
        completedAt: now,
        updatedAt: now
      }).where(eq(analysisJobs.analysisRequestId, id));
    }

    let emailSent = false;
    if (becomingReady) {
      try {
        emailSent = await sendAnalysisReady({
          analysisRequestId: existing.id,
          analysisPublicId: existing.publicId,
          email: existing.email,
          game: existing.game,
          url: reportUrl(request.url, existing.publicId),
          mistake: highestImpactMistake!
        });
      } catch { /* report remains live even if email is not configured */ }
    }
    return Response.json({ saved: true, emailSent, reportPath: `/report/${existing.publicId}` });
  } catch {
    return Response.json({ error: "Could not save this report." }, { status: 500 });
  }
}
