import type { AnalysisGame } from "./analysis";

export type AnalyticsGame = AnalysisGame | "general";
export type ProductEvent =
  | "page_view" | "cta_click" | "game_select" | "signup" | "tool_start" | "tool_complete"
  | "hardstuck_select" | "replay_selected" | "validation_failed" | "upload_started"
  | "upload_complete" | "parse_complete" | "mode_detected" | "player_pick" | "identity_captured" | "processing_started" | "abstention" | "evidence_viewed"
  | "calibration_start" | "calibration_submit"
  | "analysis_start" | "analysis_submit" | "analysis_failed" | "analysis_completed"
  | "report_view" | "followup_started" | "second_match_submitted" | "pricing_viewed" | "upgrade_intent"
  | "checkout_started" | "paid_activation" | "feedback" | "share_started";

const slugPattern = /^[a-zA-Z0-9._:-]{1,120}$/;

function safeSlug(value: string | null, maximum: number, fallback: string) {
  const candidate = (value || "").trim().slice(0, maximum);
  return slugPattern.test(candidate) ? candidate.toLowerCase() : fallback;
}

export function analyticsAttribution() {
  try {
    const params = new URLSearchParams(location.search);
    let source = safeSlug(params.get("utm_source"), 80, "direct");
    if (source === "direct" && document.referrer) {
      try { source = safeSlug(new URL(document.referrer).hostname.replace(/^www\./, ""), 80, "direct"); } catch { /* keep direct */ }
    }
    return {
      source,
      campaign: safeSlug(params.get("utm_campaign"), 120, ""),
    };
  } catch {
    return { source: "direct", campaign: "" };
  }
}

export function trackProductEvent(event: ProductEvent, game: AnalyticsGame, placement: string, source?: string) {
  try {
    let visitorId = sessionStorage.getItem("replaymethod-session-id");
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      sessionStorage.setItem("replaymethod-session-id", visitorId);
    }
    const attribution = analyticsAttribution();
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        visitorId,
        event,
        game,
        placement: safeSlug(placement, 60, "unknown"),
        path: location.pathname,
        source: source ? safeSlug(source, 80, "direct") : attribution.source,
        campaign: attribution.campaign,
      }),
    }).catch(() => {});
  } catch { /* measurement never blocks product behavior */ }
}
