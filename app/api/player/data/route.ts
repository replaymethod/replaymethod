import { getDatabase } from "../../../../db";
import { authenticatedPlayer, isSameOrigin } from "../../../../lib/player-session";
import { PLAYER_SESSION_COOKIE } from "../../../../lib/player-identity.mjs";
import { operationalErrorCode } from "../../../../lib/request-security.mjs";

export const runtime = "edge";

const activeSubscriptionStatuses = new Set(["active", "trialing", "past_due", "unpaid", "paused", "incomplete"]);

function jsonHeaders() {
  return { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" };
}

export async function GET(request: Request) {
  try {
    const database = await getDatabase();
    const player = await authenticatedPlayer(request, database);
    if (!player) return Response.json({ error: "Verify your email before exporting account data." }, { status: 401, headers: jsonHeaders() });

    const [analyses, accounts, focuses, usage, subscriptions] = await Promise.all([
      database.prepare(`SELECT ar.public_id, ar.game, ar.current_rank, ar.target_rank, ar.player_context,
        ar.evidence_type, ar.evidence_url, ar.original_file_name, ar.file_size, ar.goal, ar.notes,
        ar.status, ar.highest_impact_mistake, ar.why_it_costs, ar.evidence_moments,
        ar.next_queue_rule, ar.practice_plan, ar.coach_note, ar.feedback_score, ar.feedback_text,
        ar.case_study_consent, ar.created_at, ar.ready_at
        FROM analysis_requests ar
        JOIN analysis_jobs aj ON aj.analysis_request_id = ar.id
        WHERE aj.player_id = ? ORDER BY ar.created_at DESC`).bind(player.id).all(),
      database.prepare(`SELECT game, provider, display_name, region, connection_status, last_synced_at, created_at
        FROM game_accounts WHERE player_id = ? ORDER BY created_at`).bind(player.id).all(),
      database.prepare(`SELECT public_id, game, detector_id, status, title, success_metric, metric_key,
        metric_label, baseline_value, latest_value, target_value, unit, target_direction,
        minimum_matches, matches_observed, assigned_at, completed_at, completion_reason
        FROM player_focuses WHERE player_id = ? ORDER BY assigned_at DESC`).bind(player.id).all(),
      database.prepare(`SELECT analysis_public_id, access_kind, plan_key, window_start, window_end,
        slot, status, consumed_at, released_at, created_at
        FROM analysis_usage WHERE player_id = ? ORDER BY created_at DESC`).bind(player.id).all(),
      database.prepare(`SELECT plan_key, status, current_period_start, current_period_end,
        cancel_at_period_end, canceled_at, ended_at, grace_until, created_at, updated_at
        FROM billing_subscriptions WHERE player_id = ? ORDER BY created_at DESC`).bind(player.id).all(),
    ]);

    const exportBody = {
      exportedAt: new Date().toISOString(),
      service: "Replay Method",
      account: { publicId: player.publicId, email: player.email },
      analyses: analyses.results || [],
      gameAccounts: accounts.results || [],
      trainingFocuses: focuses.results || [],
      analysisUsage: usage.results || [],
      subscriptions: subscriptions.results || [],
      excludedOperationalData: "Secret tokens, provider identifiers, security logs and de-identified aggregate quality data are not included.",
    };
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(exportBody, null, 2), {
      headers: { ...jsonHeaders(), "Content-Disposition": `attachment; filename="replay-method-data-${stamp}.json"` },
    });
  } catch (error) {
    console.error("player data export failed", { code: operationalErrorCode(error) });
    return Response.json({ error: "Your export could not be created. Try again or contact privacy support." }, { status: 500, headers: jsonHeaders() });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isSameOrigin(request)) return Response.json({ error: "Invalid deletion request." }, { status: 403, headers: jsonHeaders() });
    const database = await getDatabase();
    const player = await authenticatedPlayer(request, database);
    if (!player) return Response.json({ error: "Verify your email before deleting account data." }, { status: 401, headers: jsonHeaders() });

    const payload = await request.json().catch(() => ({})) as { confirmation?: unknown };
    if (payload.confirmation !== "DELETE MY DATA") {
      return Response.json({ error: "Type DELETE MY DATA exactly to confirm permanent deletion." }, { status: 400, headers: jsonHeaders() });
    }

    const subscription = await database.prepare(`SELECT status FROM billing_subscriptions
      WHERE player_id = ? ORDER BY updated_at DESC LIMIT 1`).bind(player.id).first<{ status: string }>();
    if (subscription && activeSubscriptionStatuses.has(subscription.status)) {
      return Response.json({ error: "Cancel the subscription first and wait for paid access to end. This prevents deleting the account while billing rights remain active." }, { status: 409, headers: jsonHeaders() });
    }

    const storedObjects = await database.prepare(`SELECT file_key AS object_key FROM analysis_requests WHERE email = ? AND file_key IS NOT NULL
      UNION SELECT raw_object_key AS object_key FROM matches WHERE player_id = ? AND raw_object_key IS NOT NULL
      UNION SELECT normalized_object_key AS object_key FROM matches WHERE player_id = ? AND normalized_object_key IS NOT NULL
      UNION SELECT object_key FROM replay_upload_sessions WHERE email = ? AND object_key IS NOT NULL
      UNION SELECT p.object_key FROM replay_upload_parts p JOIN replay_upload_sessions s ON s.id = p.upload_session_id WHERE s.email = ?`)
      .bind(player.email, player.id, player.id, player.email, player.email).all<{ object_key: string }>();
    const objectKeys = [...new Set((storedObjects.results || []).map((row: { object_key: string }) => row.object_key).filter(Boolean))];
    if (objectKeys.length) {
      const { env } = await import("cloudflare:workers");
      const bucket = (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
      if (!bucket) return Response.json({ error: "Stored replay deletion is temporarily unavailable. No account data was deleted." }, { status: 503, headers: jsonHeaders() });
      await bucket.delete(objectKeys);
    }

    const requestIds = "SELECT id FROM analysis_requests WHERE email = ?";
    const focusIds = "SELECT id FROM player_focuses WHERE player_id = ?";
    await database.batch([
      database.prepare(`DELETE FROM player_focus_evaluations WHERE focus_id IN (${focusIds})`).bind(player.id),
      database.prepare(`DELETE FROM player_focus_observations WHERE focus_id IN (${focusIds})`).bind(player.id),
      database.prepare("DELETE FROM player_focuses WHERE player_id = ?").bind(player.id),
      database.prepare(`DELETE FROM analysis_reviews WHERE analysis_request_id IN (${requestIds})`).bind(player.email),
      database.prepare(`DELETE FROM analysis_findings WHERE analysis_request_id IN (${requestIds}) OR player_id = ?`).bind(player.email, player.id),
      database.prepare(`DELETE FROM matches WHERE analysis_request_id IN (${requestIds}) OR player_id = ?`).bind(player.email, player.id),
      database.prepare(`DELETE FROM email_deliveries WHERE analysis_request_id IN (${requestIds})`).bind(player.email),
      database.prepare(`DELETE FROM analysis_report_access WHERE analysis_request_id IN (${requestIds})`).bind(player.email),
      database.prepare("DELETE FROM analysis_usage WHERE player_id = ?").bind(player.id),
      database.prepare("DELETE FROM replay_upload_parts WHERE upload_session_id IN (SELECT id FROM replay_upload_sessions WHERE email = ?)").bind(player.email),
      database.prepare("DELETE FROM replay_upload_sessions WHERE email = ?").bind(player.email),
      database.prepare("DELETE FROM analysis_jobs WHERE player_id = ?").bind(player.id),
      database.prepare("DELETE FROM player_claims WHERE player_id = ?").bind(player.id),
      database.prepare("DELETE FROM billing_subscriptions WHERE player_id = ?").bind(player.id),
      database.prepare("DELETE FROM billing_customers WHERE player_id = ?").bind(player.id),
      database.prepare("DELETE FROM game_accounts WHERE player_id = ?").bind(player.id),
      database.prepare("DELETE FROM player_sessions WHERE player_id = ?").bind(player.id),
      database.prepare("DELETE FROM analysis_requests WHERE email = ?").bind(player.email),
      database.prepare("DELETE FROM waitlist WHERE email = ?").bind(player.email),
      database.prepare("DELETE FROM players WHERE id = ?").bind(player.id),
    ]);

    return new Response(JSON.stringify({ deleted: true }), {
      headers: { ...jsonHeaders(), "Set-Cookie": `${PLAYER_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` },
    });
  } catch (error) {
    console.error("player data deletion failed", { code: operationalErrorCode(error) });
    return Response.json({ error: "Account deletion could not be completed. Contact privacy support for help." }, { status: 500, headers: jsonHeaders() });
  }
}
