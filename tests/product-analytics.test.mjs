import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyticsPath, normalizeProductEvent, productEvents } from "../lib/analytics-policy.mjs";

const visitorId = "11111111-2222-4333-8444-555555555555";

test("redacts private bearer paths before analytics persistence", () => {
  assert.equal(analyticsPath(`/report/${"a".repeat(32)}`), "/report/:id");
  assert.equal(analyticsPath(`/access/${"A".repeat(48)}`), "/access/:token");
  assert.equal(analyticsPath("/guides/rocket-league-replay-review-checklist?email=private@example.com"), "/guides/rocket-league-replay-review-checklist");
  assert.equal(analyticsPath("/unexpected/private/value"), "/other");
});

test("accepts only coarse allowlisted product measurement fields", () => {
  const event = normalizeProductEvent({
    visitorId,
    event: "validation_failed",
    game: "rocket-league",
    placement: "invalid_type",
    path: `/report/${"b".repeat(32)}`,
    source: "TikTok",
    campaign: "rl-beta_01",
    email: "must-not-persist@example.com",
    playerContext: "private-player",
  });
  assert.deepEqual(event, {
    visitorId,
    event: "validation_failed",
    game: "rocket-league",
    placement: "invalid_type",
    path: "/report/:id",
    source: "tiktok",
    campaign: "rl-beta_01",
  });
  assert.equal(normalizeProductEvent({ visitorId, event: "made_up" }), null);
  assert.equal(normalizeProductEvent({ visitorId, event: "page_view", source: "private@example.com" })?.source, "direct");
});

test("covers the requested funnel without sending product payloads", async () => {
  for (const event of [
    "hardstuck_select", "replay_selected", "validation_failed", "upload_started",
    "analysis_start", "analysis_submit", "analysis_completed", "feedback",
    "followup_started", "upgrade_intent", "checkout_started", "paid_activation",
  ]) assert.equal(productEvents.has(event), true, event);

  const [client, route, landing, intake, quick, report, pricing, billing, history] = await Promise.all([
    readFile(new URL("../lib/client-analytics.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/events/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/Landing.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/analyze/AnalyzeFlow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/QuickReplayStart.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/report/[publicId]/ReportClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/PricingLadder.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/billing/success/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/reports/ReportsClient.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(client, /\.catch\(\(\) => \{\}\)/);
  assert.doesNotMatch(client, /email|playerContext|publicId|feedbackText|replay(?:Name|File|Bytes|Payload)|notes|goal/);
  assert.match(route, /normalizeProductEvent/);
  assert.match(landing, /hardstuck_select/);
  assert.match(intake, /replay_selected/);
  assert.match(intake, /second_match_submitted/);
  assert.match(quick, /validation_failed/);
  assert.match(report, /analysis_completed/);
  assert.match(report, /upgrade_intent/);
  assert.match(pricing, /checkout_started/);
  assert.match(billing, /paid_activation/);
  assert.match(history, /followup_started/);
});
