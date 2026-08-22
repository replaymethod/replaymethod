import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { rlReviewers } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { requireSiteAdminApi, requireSiteAdminMutation } from "../../../../lib/admin";

const qualifications = new Set(["competitive_player", "rocket_league_coach", "replay_analyst", "owner_control"]);
const statuses = new Set(["active", "revoked"]);
const ranks = new Set(["unverified", "Gold I", "Gold II", "Gold III", "Platinum I", "Platinum II", "Platinum III", "Diamond I", "Diamond II", "Diamond III", "Champion I", "Champion II", "Champion III", "Grand Champion I", "Grand Champion II", "Grand Champion III", "Supersonic Legend"]);
const rankOrder = [...ranks];
const platforms = new Set(["epic", "steam", "playstation", "xbox", "switch"]);

export async function GET() {
  const unauthorized = await requireSiteAdminApi();
  if (unauthorized) return unauthorized;
  const db = await getDb();
  const reviewers = await db.select({
    id: rlReviewers.id,
    publicId: rlReviewers.publicId,
    email: rlReviewers.email,
    displayName: rlReviewers.displayName,
    status: rlReviewers.status,
    qualification: rlReviewers.qualification,
    platform: rlReviewers.platform,
    playlistQualificationsJson: rlReviewers.playlistQualificationsJson,
    identityVerifiedAt: rlReviewers.identityVerifiedAt,
  }).from(rlReviewers);
  return Response.json({ reviewers }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const unauthorized = await requireSiteAdminMutation(request);
  if (unauthorized) return unauthorized;
  const actor = await getChatGPTUser();
  if (!actor) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const payload = await request.json() as Record<string, unknown>;
    const id = Number(payload.id);
    const status = typeof payload.status === "string" ? payload.status : "";
    const qualification = typeof payload.qualification === "string" ? payload.qualification : "";
    const platform = typeof payload.platform === "string" ? payload.platform : "";
    const qualificationNotes = typeof payload.qualificationNotes === "string" ? payload.qualificationNotes.trim().slice(0, 1000) : "";
    const qualificationConfirmed = payload.qualificationConfirmed === true;
    const rawScopes = payload.playlistQualifications && typeof payload.playlistQualifications === "object"
      ? payload.playlistQualifications as Record<string, unknown>
      : {};
    const playlistQualifications = Object.fromEntries(["1v1", "2v2", "3v3"].map(mode => {
      const scope = rawScopes[mode] && typeof rawScopes[mode] === "object" ? rawScopes[mode] as Record<string, unknown> : {};
      const currentRank = typeof scope.currentRank === "string" && ranks.has(scope.currentRank) ? scope.currentRank : "unverified";
      const highestRank = typeof scope.highestRank === "string" && ranks.has(scope.highestRank) ? scope.highestRank : "unverified";
      return [mode, { currentRank, highestRank }];
    }));
    if (!Number.isInteger(id) || id < 1 || !statuses.has(status)) {
      return Response.json({ error: "Choose a valid reviewer and status." }, { status: 400 });
    }
    if (status === "active" && !qualifications.has(qualification)) {
      return Response.json({ error: "Choose a verified reviewer qualification." }, { status: 400 });
    }
    if (status === "active" && (!platforms.has(platform) || !qualificationNotes || !qualificationConfirmed)) {
      return Response.json({ error: "Document the reviewer platform and identity/rank verification evidence before approval." }, { status: 400 });
    }
    if (status === "active" && Object.values(playlistQualifications).every(scope => scope.currentRank === "unverified" || scope.highestRank === "unverified")) {
      return Response.json({ error: "Verify current and historical rank for at least one playlist before approval." }, { status: 400 });
    }
    if (status === "active" && Object.values(playlistQualifications).some(scope => (
      scope.currentRank !== "unverified" && scope.highestRank !== "unverified"
      && rankOrder.indexOf(scope.currentRank) > rankOrder.indexOf(scope.highestRank)
    ))) {
      return Response.json({ error: "A current rank cannot be above the verified historical peak." }, { status: 400 });
    }

    const db = await getDb();
    const reviewer = await db.select().from(rlReviewers).where(eq(rlReviewers.id, id)).get();
    if (!reviewer) return Response.json({ error: "Reviewer not found." }, { status: 404 });
    const now = new Date().toISOString();
    await db.update(rlReviewers).set({
      status,
      qualification: status === "active" ? qualification : reviewer.qualification,
      playlistQualificationsJson: status === "active" ? JSON.stringify(playlistQualifications) : reviewer.playlistQualificationsJson,
      platform: status === "active" ? platform : reviewer.platform,
      qualificationNotes: status === "active" ? qualificationNotes : reviewer.qualificationNotes,
      identityVerifiedAt: status === "active" ? now : reviewer.identityVerifiedAt,
      approvedBy: status === "active" ? actor.email.toLowerCase() : reviewer.approvedBy,
      approvedAt: status === "active" ? now : reviewer.approvedAt,
      revokedAt: status === "revoked" ? now : null,
      updatedAt: now
    }).where(eq(rlReviewers.id, id));
    return Response.json({ saved: true });
  } catch {
    return Response.json({ error: "Could not update reviewer access." }, { status: 500 });
  }
}
