import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { analysisJobs, analysisRequests, analysisUsage } from "../../../../../../db/schema";
import { requireSiteAdminMutation } from "../../../../../../lib/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireSiteAdminMutation(request);
  if (unauthorized) return unauthorized;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Invalid analysis." }, { status: 400 });

  const db = await getDb();
  const job = await db.select().from(analysisJobs).where(eq(analysisJobs.analysisRequestId, id)).get();
  if (!job) return Response.json({ error: "This legacy report has no automated job to retry." }, { status: 409 });
  const usage = await db.select({ status: analysisUsage.status }).from(analysisUsage).where(eq(analysisUsage.analysisRequestId, id)).get();
  if (["queued", "retry"].includes(job.status) && usage?.status !== "consumed") {
    return Response.json({ queued: true, jobPublicId: job.publicId, idempotent: true }, { headers: { "Cache-Control": "no-store" } });
  }
  let staleRunning = false;
  if (job.status === "running") {
    const updatedAt = new Date(job.updatedAt.includes("T") ? job.updatedAt : `${job.updatedAt.replace(" ", "T")}Z`).getTime();
    if (!Number.isFinite(updatedAt) || Date.now() - updatedAt < 180_000) {
      return Response.json({ error: "This analysis is already running." }, { status: 409 });
    }
    staleRunning = true;
  }
  const gatingUpgrade = ["public_output_disabled", "detectors_not_calibrated"].includes(job.errorCode || "")
    && usage?.status === "released";
  const ordinaryRetry = (["blocked", "failed"].includes(job.status) || staleRunning) && usage?.status !== "consumed";
  if (!gatingUpgrade && !ordinaryRetry) {
    return Response.json({ error: "A completed or consumed analysis cannot be queued again." }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }

  const now = new Date().toISOString();
  await db.batch([
    db.update(analysisUsage).set({
      status: "released",
      releasedAt: now,
      updatedAt: now,
    }).where(and(eq(analysisUsage.analysisRequestId, id), eq(analysisUsage.status, "reserved"))),
    db.update(analysisJobs).set({
      status: "queued",
      stage: "queued",
      stageLabel: "Retry requested",
      attempts: 0,
      errorCode: null,
      errorMessage: null,
      nextRetryAt: null,
      completedAt: null,
      updatedAt: now
    }).where(eq(analysisJobs.id, job.id)),
    db.update(analysisRequests).set({ status: "received", updatedAt: now }).where(eq(analysisRequests.id, id))
  ]);
  return Response.json({ queued: true, jobPublicId: job.publicId, upgrade: gatingUpgrade }, { headers: { "Cache-Control": "no-store" } });
}
