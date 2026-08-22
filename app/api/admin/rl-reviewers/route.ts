import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { rlReviewers } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { requireSiteAdminMutation } from "../../../../lib/admin";

const qualifications = new Set(["competitive_player", "rocket_league_coach", "replay_analyst"]);
const statuses = new Set(["active", "revoked"]);
const ranks = new Set(["unverified", "Gold I", "Gold II", "Gold III", "Platinum I", "Platinum II", "Platinum III", "Diamond I", "Diamond II", "Diamond III", "Champion I", "Champion II", "Champion III", "Grand Champion I", "Grand Champion II", "Grand Champion III", "Supersonic Legend"]);

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
    const rawScopes = payload.playlistQualifications && typeof payload.playlistQualifications === "object"
      ? payload.playlistQualifications as Record<string, unknown>
      : {};
    const playlistQualifications = Object.fromEntries(["1v1", "2v2", "3v3"].map(mode => [mode, typeof rawScopes[mode] === "string" && ranks.has(rawScopes[mode]) ? rawScopes[mode] : "unverified"]));
    if (!Number.isInteger(id) || id < 1 || !statuses.has(status)) {
      return Response.json({ error: "Choose a valid reviewer and status." }, { status: 400 });
    }
    if (status === "active" && !qualifications.has(qualification)) {
      return Response.json({ error: "Choose a verified reviewer qualification." }, { status: 400 });
    }
    if (status === "active" && Object.values(playlistQualifications).every(rank => rank === "unverified")) {
      return Response.json({ error: "Verify at least one playlist-specific rank before approval." }, { status: 400 });
    }

    const db = await getDb();
    const reviewer = await db.select().from(rlReviewers).where(eq(rlReviewers.id, id)).get();
    if (!reviewer) return Response.json({ error: "Reviewer not found." }, { status: 404 });
    const now = new Date().toISOString();
    await db.update(rlReviewers).set({
      status,
      qualification: status === "active" ? qualification : reviewer.qualification,
      playlistQualificationsJson: status === "active" ? JSON.stringify(playlistQualifications) : reviewer.playlistQualificationsJson,
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
