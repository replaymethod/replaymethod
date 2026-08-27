import assert from "node:assert/strict";
import test from "node:test";
import { buildDecisionContexts } from "./decision-context.mjs";

function player(id, team, distanceToBall, x, y, z = 17) {
  return { id, team, distanceToBall, boost: 100, position: { x, y, z }, linearVelocity: { x: 900, y: 0, z: 0 } };
}

test("builds comparable first-touch context with access, pressure, coverage and outcome", () => {
  const frame = {
    index: 30, timeSeconds: 3, secondsRemaining: 80, ball: { position: { x: 0, y: 500, z: 100 } },
    players: [
      player("epic:subject", 0, 400, 0, 0),
      player("epic:mate", 0, 1600, -500, -1800),
      player("epic:opponent", 1, 900, 0, 1200),
    ],
  };
  const firstTouch = {
    id: "touch:1", type: "touch", playerId: "epic:subject", participantPlayerIds: ["epic:subject"],
    subjectInvolved: true, team: 0, startTimeSeconds: 3, startFrame: 30,
    facts: { tags: [{ group: "reception", value: "first_touch" }, { group: "action", value: "control" }] },
  };
  const opponentTouch = {
    id: "touch:2", type: "touch", playerId: "epic:opponent", participantPlayerIds: ["epic:opponent"],
    subjectInvolved: false, team: 1, startTimeSeconds: 4, startFrame: 40, facts: {},
  };
  const normalized = {
    subjectPlayerId: "epic:subject", mode: "Ranked Doubles",
    metadata: { performanceSnapshot: { match: { teamScore: 1, opponentScore: 2 } } },
  };
  const result = buildDecisionContexts({
    normalized,
    frameState: { sampleRateHz: 10, players: frame.players, frames: [frame] },
    episodeTimeline: { events: [firstTouch, opponentTouch] },
    adaptiveSampling: { detailSampleRateHz: 30, detailFrames: [frame], windows: [{ eventId: "touch:1", sampleRateHz: 30, frameIndexes: [30] }] },
  });
  assert.equal(result.opportunities.length, 5);
  const retention = result.opportunities.find((item) => item.opportunityType === "first_touch_retention");
  assert.equal(retention.context.accessOrder, "first");
  assert.equal(retention.context.accessBasis, "kinematic_intercept_proxy_v1");
  assert.equal(retention.context.role, "first");
  assert.equal(retention.context.pressure, "high");
  assert.equal(retention.context.coverage, "layered");
  assert.equal(retention.context.score, "tied");
  assert.equal(retention.outcome.nextTeam, "opponent");
  assert.match(retention.contextKey, /first_touch_retention:unknown:opponent_half:first/);
  assert.ok(result.opportunities.some((item) => item.opportunityType === "possession_giveaway"));
  assert.ok(result.opportunities.some((item) => item.opportunityType === "first_touch_quality"));
  assert.ok(result.opportunities.some((item) => item.opportunityType === "team_spacing_decision"));
  assert.ok(result.opportunities.some((item) => item.opportunityType === "team_commitment_decision"));
});

test("builds attributable boost, kickoff, center and defensive-clear opportunities", () => {
  const frame = {
    index: 10, timeSeconds: 1, secondsRemaining: 250,
    ball: { position: { x: 0, y: -1200, z: 100 }, linearVelocity: { x: 0, y: 600, z: 0 } },
    players: [
      player("epic:subject", 0, 500, 0, -1600),
      player("epic:mate", 0, 1500, -800, -2600),
      player("epic:opponent", 1, 1000, 0, -300),
    ],
  };
  const events = [
    { id: "boost:1", type: "boost_pickup", playerId: "epic:subject", subjectInvolved: true, team: 0, startTimeSeconds: 1, startFrame: 10, facts: { pad_type: "large", overfill_amount: 32, boost_before: 80, boost_after: 100 } },
    { id: "kickoff:1", type: "kickoff", subjectInvolved: true, startTimeSeconds: 2, startFrame: 20, facts: { team_zero_taker: { player: { Epic: "subject" } }, kickoff_type: "standard", direction: "left", winning_team_is_team_0: false } },
    { id: "center:1", type: "center", playerId: "epic:subject", subjectInvolved: true, team: 0, startTimeSeconds: 3, startFrame: 30, facts: { ball_travel_distance: 1800 } },
    { id: "clear:1", type: "touch", playerId: "epic:subject", subjectInvolved: true, team: 0, startTimeSeconds: 4, startFrame: 40, facts: { ball_position: [0, -2000, 100], tags: [{ group: "action", value: "clear" }] } },
    { id: "touch:opponent", type: "touch", playerId: "epic:opponent", subjectInvolved: false, team: 1, startTimeSeconds: 4.5, startFrame: 45, facts: {} },
  ];
  const result = buildDecisionContexts({
    normalized: { subjectPlayerId: "epic:subject", mode: "Ranked Doubles" },
    frameState: { sampleRateHz: 10, players: frame.players, frames: [frame] },
    episodeTimeline: { events },
    adaptiveSampling: { detailSampleRateHz: 30, detailFrames: [frame], windows: [] },
  });
  const types = new Set(result.opportunities.map((item) => item.opportunityType));
  for (const type of ["boost_overfill", "kickoff_contact", "offense_center_outcome", "possession_giveaway", "defensive_clear_outcome"]) {
    assert.ok(types.has(type), `missing ${type}`);
  }
  assert.equal(result.opportunities.find((item) => item.opportunityType === "kickoff_contact").context.subjectTeam, 0);
});

test("turns complete boost presses and zero-reserve episodes into decision opportunities", () => {
  const makeFrame = (index, timeSeconds, boostPercent, speed) => ({
    index, timeSeconds, secondsRemaining: 250 - timeSeconds,
    ball: { position: { x: 0, y: 0, z: 100 }, linearVelocity: { x: 0, y: 0, z: 0 } },
    players: [
      { id: "epic:subject", team: 0, boostPercent, distanceToBall: 900, position: { x: -900, y: 0, z: 17 }, linearVelocity: { x: speed, y: 0, z: 0 } },
      { id: "epic:opponent", team: 1, boostPercent: 50, distanceToBall: 1300, position: { x: 1300, y: 0, z: 17 }, linearVelocity: { x: -500, y: 0, z: 0 } },
    ],
  });
  const frames = [
    makeFrame(0, 0, 100, 2200), makeFrame(1, 0.1, 95, 2200), makeFrame(2, 0.2, 90, 2200), makeFrame(3, 0.3, 90, 2200),
    makeFrame(10, 1, 0, 500), makeFrame(11, 1.1, 0, 500), makeFrame(12, 1.2, 0, 500), makeFrame(13, 1.3, 10, 600),
  ];
  const result = buildDecisionContexts({
    normalized: { subjectPlayerId: "epic:subject", mode: "Ranked Duel" },
    frameState: { sampleRateHz: 10, players: frames[0].players, frames },
    episodeTimeline: { phases: [{ phase: "active_play", livePlay: true, startTimeSeconds: 0, endTimeSeconds: 2 }], events: [] },
    adaptiveSampling: { detailFrames: [], windows: [] },
  });
  const press = result.opportunities.find((item) => item.opportunityType === "boost_press_efficiency");
  const zero = result.opportunities.find((item) => item.opportunityType === "zero_boost_exposure");
  assert.equal(press.eventFacts.boost_spent_percent, 10);
  assert.equal(press.eventFacts.supersonic_fraction, 1);
  assert.equal(press.eligible, true);
  assert.ok(Math.abs(zero.eventFacts.duration_seconds - 0.2) < 1e-9);
  assert.equal(zero.eventFacts.ended_with_reserve, true);
});
