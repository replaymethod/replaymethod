import { getDb } from "../../../db";
import { funnelEvents } from "../../../db/schema";

const allowedEvents = new Set([
  "page_view", "cta_click", "game_select", "signup", "tool_start", "tool_complete",
  "connect_started", "connect_completed", "upload_started", "analysis_start", "analysis_submit",
  "analysis_failed", "analysis_completed", "report_view", "evidence_opened", "training_plan_viewed",
  "next_focus_started", "second_match_submitted", "pricing_viewed", "feedback", "share_started", "share_completed"
]);
const allowedGames = new Set(["general", "league", "valorant", "rocket-league"]);
const visitorPattern = /^[a-zA-Z0-9-]{8,64}$/;
const clean = (value: unknown, length: number) => typeof value === "string" ? value.trim().slice(0, length) : "";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const visitorId = clean(payload.visitorId, 64);
    const event = clean(payload.event, 30);
    const game = allowedGames.has(clean(payload.game, 30)) ? clean(payload.game, 30) : "general";
    if (!visitorPattern.test(visitorId) || !allowedEvents.has(event)) return new Response(null, { status: 400 });

    const db = await getDb();
    await db.insert(funnelEvents).values({
      visitorId,
      event,
      game,
      placement: clean(payload.placement, 60) || "unknown",
      path: clean(payload.path, 160) || "/",
      source: clean(payload.source, 80).toLowerCase() || "direct",
      campaign: clean(payload.campaign, 120) || null
    });
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch {
    // Analytics is deliberately fail-soft and never affects the waitlist flow.
    return new Response(null, { status: 204 });
  }
}
