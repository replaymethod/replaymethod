export const productEvents = new Set([
  "page_view", "cta_click", "game_select", "signup", "tool_start", "tool_complete",
  "hardstuck_select", "connect_started", "connect_completed", "replay_selected",
  "validation_failed", "upload_started", "analysis_start", "analysis_submit",
  "analysis_failed", "analysis_completed", "report_view", "evidence_opened",
  "training_plan_viewed", "next_focus_started", "followup_started",
  "second_match_submitted", "pricing_viewed", "upgrade_intent", "checkout_started",
  "paid_activation", "feedback", "share_started", "share_completed",
]);

export const productGames = new Set(["general", "league", "valorant", "rocket-league"]);
const visitorPattern = /^[a-zA-Z0-9-]{8,64}$/;
const slugPattern = /^[a-zA-Z0-9._:-]{1,120}$/;

function text(value, maximum) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export function analyticsPath(value) {
  const path = text(value, 300).split(/[?#]/, 1)[0] || "/";
  if (/^\/report\/[a-f0-9]{32}$/.test(path)) return "/report/:id";
  if (/^\/access\/[a-zA-Z0-9_-]{32,256}$/.test(path)) return "/access/:token";
  if (/^\/guides\/[a-z0-9-]{1,100}$/.test(path)) return path;
  if (/^\/(?:|analyze|beta-terms|billing\/success|climb-check|guides|league|privacy|replay-upload|reports|rocket-league|terms|valorant)$/.test(path)) return path;
  return "/other";
}

export function coarseAnalyticsValue(value, maximum, fallback = "") {
  const candidate = text(value, maximum);
  return slugPattern.test(candidate) ? candidate.toLowerCase() : fallback;
}

export function normalizeProductEvent(payload = {}) {
  const visitorId = text(payload.visitorId, 64);
  const event = text(payload.event, 30);
  if (!visitorPattern.test(visitorId) || !productEvents.has(event)) return null;
  const gameValue = text(payload.game, 30);
  return {
    visitorId,
    event,
    game: productGames.has(gameValue) ? gameValue : "general",
    placement: coarseAnalyticsValue(payload.placement, 60, "unknown"),
    path: analyticsPath(payload.path),
    source: coarseAnalyticsValue(payload.source, 80, "direct"),
    campaign: coarseAnalyticsValue(payload.campaign, 120) || null,
  };
}
