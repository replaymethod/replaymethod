import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { rlReviewCandidates, rlReviewLabels } from "../../../../../db/schema";
import { requireRlReviewerMutation } from "../../../../../lib/admin";
import { reviewerPlaylistScopes, RL_LABEL_SET_VERSION } from "../../../../../lib/rl-review";

const gameplayTruths = new Set(["present", "absent", "uncertain"]);
const verificationResults = new Set(["verified", "incorrect", "uncertain"]);
const coachingRelevances = new Set(["actionable", "not_actionable", "uncertain"]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireRlReviewerMutation(request);
  if (access.response || !access.reviewer || !access.user) return access.response;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Invalid candidate" }, { status: 400 });

  try {
    const payload = await request.json() as Record<string, unknown>;
    const gameplayTruth = typeof payload.gameplayTruth === "string" ? payload.gameplayTruth : "";
    const timestampResult = typeof payload.timestampResult === "string" ? payload.timestampResult : "";
    const contextResult = typeof payload.contextResult === "string" ? payload.contextResult : "";
    const coachingRelevance = typeof payload.coachingRelevance === "string" ? payload.coachingRelevance : "";
    if (!gameplayTruths.has(gameplayTruth) || !verificationResults.has(timestampResult) || !verificationResults.has(contextResult) || !coachingRelevances.has(coachingRelevance)) {
      return Response.json({ error: "Complete gameplay truth, timestamp, context and coaching relevance before locking." }, { status: 400 });
    }
    const notes = typeof payload.notes === "string" ? payload.notes.trim().slice(0, 2500) : "";
    const db = await getDb();
    const candidate = await db.select().from(rlReviewCandidates).where(eq(rlReviewCandidates.id, id)).get();
    if (!candidate || !candidate.active || !candidate.momentObjectKey) return Response.json({ error: "Active private candidate not found." }, { status: 404 });
    if (!candidate.mode || !reviewerPlaylistScopes(access.reviewer.playlistQualificationsJson).has(candidate.mode)) {
      return Response.json({ error: "This candidate is outside your verified playlist scope." }, { status: 403 });
    }
    const existing = await db.select({ id: rlReviewLabels.id }).from(rlReviewLabels).where(and(
      eq(rlReviewLabels.candidateId, id),
      eq(rlReviewLabels.reviewerId, access.reviewer.id),
      eq(rlReviewLabels.labelSetVersion, RL_LABEL_SET_VERSION)
    )).get();
    if (existing) return Response.json({ error: "This independent judgment is already locked." }, { status: 409 });

    const { env } = await import("cloudflare:workers");
    const database = env.DB as D1Database;
    const now = new Date().toISOString();
    const timestampVerified = timestampResult === "uncertain" ? null : timestampResult === "verified" ? 1 : 0;
    const contextCorrect = contextResult === "uncertain" ? null : contextResult === "verified" ? 1 : 0;
    const verdict = gameplayTruth === "absent" || timestampResult === "incorrect" || contextResult === "incorrect"
      ? "rejected"
      : gameplayTruth === "present" && timestampResult === "verified" && contextResult === "verified"
        ? "confirmed"
        : "uncertain";
    await database.batch([
      database.prepare(`UPDATE rl_review_candidates SET updated_at = ? WHERE id = ?`).bind(
        now, id
      ),
      database.prepare(`INSERT INTO rl_review_labels (
        candidate_id, reviewer_id, reviewer_email, reviewer_qualification, reviewer_scope_json, verdict,
        timestamp_verified, gameplay_truth, context_correct, coaching_relevance, notes, label_set_version
      ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM rl_review_labels WHERE candidate_id = ? AND reviewer_id = ? AND label_set_version = ?
      )`).bind(
        id, access.reviewer.id, access.reviewer.email, access.reviewer.qualification,
        access.reviewer.playlistQualificationsJson, verdict, timestampVerified, gameplayTruth,
        contextCorrect, coachingRelevance, notes || null, RL_LABEL_SET_VERSION,
        id, access.reviewer.id, RL_LABEL_SET_VERSION
      )
    ]);
    return Response.json({ saved: true, locked: true, verdict, labelSetVersion: RL_LABEL_SET_VERSION });
  } catch {
    return Response.json({ error: "Could not save this review." }, { status: 500 });
  }
}
