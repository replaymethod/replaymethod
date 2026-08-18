import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { rlReviewCandidates } from "../../../../../db/schema";
import { requireSiteAdminApi } from "../../../../../lib/admin";
import { isRlReviewVerdict, RL_LABEL_SET_VERSION } from "../../../../../lib/rl-review";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireSiteAdminApi();
  if (unauthorized) return unauthorized;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Invalid candidate" }, { status: 400 });

  try {
    const payload = await request.json() as Record<string, unknown>;
    if (!isRlReviewVerdict(payload.verdict)) return Response.json({ error: "Choose a valid verdict." }, { status: 400 });
    if (payload.timestampVerified !== null && typeof payload.timestampVerified !== "boolean") return Response.json({ error: "Choose a valid timestamp result." }, { status: 400 });
    const notes = typeof payload.notes === "string" ? payload.notes.trim().slice(0, 2500) : "";
    const db = await getDb();
    const candidate = await db.select().from(rlReviewCandidates).where(eq(rlReviewCandidates.id, id)).get();
    if (!candidate) return Response.json({ error: "Candidate not found" }, { status: 404 });

    const { env } = await import("cloudflare:workers");
    const database = env.DB as D1Database;
    const user = await import("../../../../chatgpt-auth").then(module => module.getChatGPTUser());
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const now = new Date().toISOString();
    const timestampVerified = payload.timestampVerified == null ? null : payload.timestampVerified ? 1 : 0;
    await database.batch([
      database.prepare(`UPDATE rl_review_candidates SET verdict = ?, timestamp_verified = ?, notes = ?, reviewer_email = ?, label_set_version = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`).bind(
        payload.verdict, timestampVerified, notes || null, user.email, RL_LABEL_SET_VERSION, payload.verdict === "unreviewed" ? null : now, now, id
      ),
      database.prepare(`INSERT INTO rl_review_labels (candidate_id, reviewer_email, verdict, timestamp_verified, notes, label_set_version) VALUES (?, ?, ?, ?, ?, ?)`).bind(
        id, user.email, payload.verdict, timestampVerified, notes || null, RL_LABEL_SET_VERSION
      )
    ]);
    return Response.json({ saved: true, labelSetVersion: RL_LABEL_SET_VERSION });
  } catch {
    return Response.json({ error: "Could not save this review." }, { status: 500 });
  }
}
