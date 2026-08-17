import { eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { analysisJobs, analysisRequests } from "../../../../../../db/schema";
import { requireSiteAdminApi } from "../../../../../../lib/admin";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireSiteAdminApi();
  if (unauthorized) return unauthorized;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Invalid analysis." }, { status: 400 });

  const db = await getDb();
  const job = await db.select().from(analysisJobs).where(eq(analysisJobs.analysisRequestId, id)).get();
  if (!job) return Response.json({ error: "This legacy report has no automated job to retry." }, { status: 409 });
  if (job.status === "running") return Response.json({ error: "This analysis is already running." }, { status: 409 });

  await db.batch([
    db.update(analysisJobs).set({
      status: "queued",
      stage: "queued",
      stageLabel: "Retry requested",
      attempts: 0,
      errorCode: null,
      errorMessage: null,
      nextRetryAt: null,
      completedAt: null,
      updatedAt: new Date().toISOString()
    }).where(eq(analysisJobs.id, job.id)),
    db.update(analysisRequests).set({ status: "received", updatedAt: new Date().toISOString() }).where(eq(analysisRequests.id, id))
  ]);
  return Response.json({ queued: true, jobPublicId: job.publicId }, { headers: { "Cache-Control": "no-store" } });
}
