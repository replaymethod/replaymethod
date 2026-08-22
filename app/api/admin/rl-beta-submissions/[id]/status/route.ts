import { eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { rlBetaSubmissions } from "../../../../../../db/schema";
import { requireSiteAdminMutation } from "../../../../../../lib/admin";

const parserStates = new Set(["pending", "parsed", "failed"]);
const attributionStates = new Set(["pending", "matched", "mismatch", "ambiguous"]);
const usabilityStates = new Set(["pending", "usable", "rejected"]);
const reviewStates = new Set(["not_started", "queued", "in_review", "reviewed"]);
const modes = new Set(["1v1", "2v2", "3v3", "private", "unknown"]);
const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireSiteAdminMutation(request);
  if (unauthorized) return unauthorized;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Invalid replay." }, { status: 400 });

  try {
    const payload = await request.json() as Record<string, unknown>;
    const parserStatus = text(payload.parserStatus, 30);
    const attributionStatus = text(payload.attributionStatus, 30);
    const usabilityStatus = text(payload.usabilityStatus, 30);
    const reviewState = text(payload.reviewState, 30);
    const parsedMode = text(payload.parsedMode, 20);
    if (!parserStates.has(parserStatus) || !attributionStates.has(attributionStatus) || !usabilityStates.has(usabilityStatus) || !reviewStates.has(reviewState) || (parsedMode && !modes.has(parsedMode))) {
      return Response.json({ error: "Choose valid replay pipeline states." }, { status: 400 });
    }
    const db = await getDb();
    const row = await db.select({ id: rlBetaSubmissions.id }).from(rlBetaSubmissions).where(eq(rlBetaSubmissions.id, id)).get();
    if (!row) return Response.json({ error: "Replay not found." }, { status: 404 });
    await db.update(rlBetaSubmissions).set({
      parserStatus,
      parserVersion: text(payload.parserVersion, 100) || null,
      parsedMode: parsedMode || null,
      attributionStatus,
      usabilityStatus,
      reviewState,
      detectorSetVersion: text(payload.detectorSetVersion, 100) || null,
      processingErrorCode: text(payload.processingErrorCode, 100) || null,
      updatedAt: new Date().toISOString()
    }).where(eq(rlBetaSubmissions.id, id));
    return Response.json({ saved: true });
  } catch {
    return Response.json({ error: "Could not update replay state." }, { status: 500 });
  }
}
