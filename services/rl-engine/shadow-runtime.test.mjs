import assert from "node:assert/strict";
import test from "node:test";
import { buildDecisionContexts } from "./decision-context.mjs";
import { decisionEngineMetadata, runShadowDetectors } from "./shadow-runtime.mjs";

function evidenceFixture() {
  const subject = { id: "epic:subject", name: "Subject", team: 0 };
  const frames = Array.from({ length: 9 }, (_, index) => ({
    index,
    timeSeconds: index / 10,
    players: [{ ...subject, boost: index < 7 ? 0 : 10 }],
  }));
  return {
    normalized: { subjectPlayerId: subject.id },
    frameState: { frames },
    episodeTimeline: {
      phases: [{ livePlay: true, startTimeSeconds: 0, endTimeSeconds: 1 }],
      events: [
        {
          type: "kickoff", subjectInvolved: true, startTimeSeconds: 0,
          facts: {
            outcome: "team_zero_win",
            team_zero_taker: {
              player: { Epic: "subject" }, time_to_ball: 1.95,
              spawn_position: "diagonal_left", approach: "diagonal_flip", contact_gap: 12,
            },
          },
        },
        {
          type: "touch", subjectInvolved: true, startTimeSeconds: 4, startFrame: 100,
          facts: { role: "first_man", ball_speed_change: 500, tags: [
            { group: "reception", value: "first_touch" },
            { group: "action", value: "boom" },
          ] },
        },
        {
          type: "whiff", subjectInvolved: true, startTimeSeconds: 5, startFrame: 120,
          facts: { kind: "beaten_to_ball", closest_approach_distance: 120, approach_speed: 2200, aerial: true },
        },
      ],
    },
    decisionContext: {
      schemaVersion: "rocket-league-decision-context@0.5.0",
      opportunities: [
        {
          id: "zero:1", opportunityType: "zero_boost_exposure", eligible: true, timestampSeconds: 0, frame: 0,
          contextKey: "1v1:zero", context: { mode: "1v1" }, eventFacts: { duration_seconds: 0.6, ended_with_reserve: true }, outcome: {},
        },
        {
          id: "kickoff-speed:1", opportunityType: "kickoff_speed", eligible: true, timestampSeconds: 0, frame: 0,
          contextKey: "1v1:kickoff", context: { mode: "1v1", subjectTeam: 0 },
          eventFacts: { team_zero_taker: { time_to_ball: 2.4, spawn_position: "diagonal_left", approach: "front_flip" } }, outcome: {},
        },
        {
          id: "first-touch:1", opportunityType: "first_touch_quality", eligible: true, timestampSeconds: 4, frame: 100,
          contextKey: "1v1:first", context: { mode: "1v1", pressure: "low" },
          eventFacts: { tags: [{ group: "action", value: "boom" }], ball_speed_change: 2000 }, outcome: { nextTeam: "opponent", nextEventSeconds: 1 },
        },
        {
          id: "dive:1", opportunityType: "challenge_dive", eligible: true, timestampSeconds: 5, frame: 120,
          sourceEventType: "whiff", contextKey: "1v1:dive", context: { mode: "1v1", coverage: "not_applicable", defensiveRole: "solo" },
          eventFacts: { kind: "beaten_to_ball", closest_approach_distance: 120 }, outcome: { nextTeam: "opponent" },
        },
      ],
    },
  };
}

test("executes shadow observations without making them public findings", () => {
  const result = runShadowDetectors(evidenceFixture());
  assert.equal(result.summary.detectorCount, 60);
  assert.equal(result.summary.executed, 60);
  assert.equal(result.summary.measuringExecuted, 60);
  assert.equal(result.summary.errors, 0);
  assert.ok(result.summary.observed >= 4);
  assert.equal(result.summary.publicEligible, 0);
  assert.equal(result.summary.measuring, 60);
  assert.equal(result.summary.capabilityAbstained, 0);
  const expanded = result.runs.find((run) => run.detectorId === "boost.large_pad_detour");
  assert.equal(expanded.implementationStatus, "measuring");
  assert.equal(expanded.status, "no_signal");
  assert.equal(expanded.opportunityContract.summary.totalOpportunities, 0);

  const boost = result.runs.find((run) => run.detectorId === "boost.zero_duration");
  assert.equal(boost.candidateCount, 1);
  assert.equal(boost.opportunityContract.summary.nonFiringOpportunities, 0);
  assert.equal(boost.public, false);

  const kickoff = result.runs.find((run) => run.detectorId === "kickoff.speed");
  assert.equal(kickoff.candidateCount, 1);

  const touch = result.runs.find((run) => run.detectorId === "possession.first_touch");
  assert.equal(touch.candidateCount, 1);

  const challenge = result.runs.find((run) => run.detectorId === "challenge.dive");
  assert.equal(challenge.candidateCount, 1);
});

test("contains detector failures instead of failing the whole replay", () => {
  const result = runShadowDetectors(evidenceFixture(), [{
    id: "test.failure",
    version: "1",
    evaluate() { throw new Error("broken probe"); },
  }]);
  assert.equal(result.summary.errors, 1);
  assert.equal(result.runs[0].status, "error");
  assert.equal(result.runs[0].error, "broken probe");
});

test("groups adjacent supersonic boost samples into one reviewable decision", () => {
  const subject = { id: "epic:subject", name: "Subject", team: 0 };
  const boosts = [255, 242.25, 229.5, 216.75, 204, 204];
  const frames = boosts.map((boost, index) => ({
    index,
    timeSeconds: index / 10,
    ball: { position: { x: 0, y: 0, z: 0 } },
    players: [{
      ...subject,
      boost,
      distanceToBall: 1200,
      position: { x: 1000, y: 0, z: 0 },
      linearVelocity: { x: 2200, y: 0, z: 0 },
    }],
  }));
  const evidence = {
    normalized: { subjectPlayerId: subject.id, mode: "Ranked Duel" },
    frameState: { frames },
    episodeTimeline: {
      phases: [{ livePlay: true, startTimeSeconds: 0, endTimeSeconds: 1 }],
      events: [],
    },
    adaptiveSampling: { detailFrames: [], windows: [] },
  };
  evidence.decisionContext = buildDecisionContexts(evidence);
  const result = runShadowDetectors(evidence);
  const boost = result.runs.find((run) => run.detectorId === "boost.supersonic_waste");

  assert.equal(boost.detectorVersion, "0.4.0");
  assert.equal(boost.candidateCount, 1);
  assert.equal(boost.evidence[0].sampledFrames, 4);
  assert.equal(boost.evidence[0].boostSpent, 20);
});

test("marks teammate detectors not applicable in ranked 1v1", () => {
  const evidence = evidenceFixture();
  evidence.normalized.mode = "Ranked Duel";
  const result = runShadowDetectors(evidence);
  assert.equal(result.runs.find((run) => run.detectorId === "rotation.spacing_too_close").status, "not_applicable");
  assert.equal(result.runs.find((run) => run.detectorId === "teamplay.double_commit").status, "not_applicable");
  assert.equal(result.summary.notApplicable, 21);
  assert.equal(result.summary.executed, 39);
});

test("new decision detectors preserve non-firings beside candidates", () => {
  const evidence = evidenceFixture();
  evidence.decisionContext = {
    schemaVersion: "rocket-league-decision-context@0.2.0",
    summary: { opportunityCount: 4, eligibleCount: 4, abstainedCount: 0, byType: {} },
    opportunities: [
      {
        id: "first:1", opportunityType: "first_touch_retention", eligible: true, timestampSeconds: 1, frame: 10,
        contextKey: "2v2:first:first:loose:low:normal", context: { pressure: "low", coverage: "layered", mode: "ranked_doubles" },
        eventFacts: { tags: [{ group: "action", value: "control" }] }, outcome: { nextTeam: "opponent", nextEventSeconds: 1 },
      },
      {
        id: "first:2", opportunityType: "first_touch_retention", eligible: true, timestampSeconds: 2, frame: 20,
        contextKey: "2v2:first:first:loose:low:normal", context: { pressure: "low", coverage: "layered", mode: "ranked_doubles" },
        eventFacts: { tags: [{ group: "action", value: "control" }] }, outcome: { nextTeam: "subject_team", nextEventSeconds: 1 },
      },
      {
        id: "challenge:1", opportunityType: "challenge_quality", eligible: true, timestampSeconds: 3, frame: 30,
        sourceEventType: "whiff", contextKey: "2v2:challenge:last:loose:high:normal",
        context: { pressure: "high", coverage: "exposed", mode: "ranked_doubles", accessOrder: "last" },
        eventFacts: { kind: "beaten_to_ball", closest_approach_distance: 120, approach_speed: 2100 }, outcome: {},
      },
      {
        id: "recovery:1", opportunityType: "recovery_reentry", eligible: true, timestampSeconds: 4, frame: 40,
        contextKey: "2v2:recovery:last:loose:medium:normal", context: { coverage: "exposed" },
        subject: { distanceToBall: 2400 }, outcome: { classification: "slow_reentry", timeToUsefulSpeed: 1.1, peakSpeed: 1300 },
      },
    ],
  };
  evidence.adaptiveSampling = { schemaVersion: "adaptive@1", summary: { windowCount: 2, retainedFrameCount: 80, eventTypes: {} } };
  const result = runShadowDetectors(evidence);
  const retention = result.runs.find((run) => run.detectorId === "possession.first_touch_retention");
  const challenge = result.runs.find((run) => run.detectorId === "challenge.quality");
  const recovery = result.runs.find((run) => run.detectorId === "recovery.reentry_quality");
  assert.equal(retention.candidateCount, 1);
  assert.equal(retention.opportunityContract.summary.nonFiringOpportunities, 1);
  assert.equal(challenge.candidateCount, 1);
  assert.equal(recovery.candidateCount, 1);
  const metadata = decisionEngineMetadata(evidence, result);
  assert.equal(metadata.detectors.length, 60);
  assert.equal(metadata.detectors.find((item) => item.detectorId === "possession.first_touch_retention").evaluations.length, 2);
});

test("five expanded opportunity detectors retain firings, non-firings and abstentions", () => {
  const evidence = evidenceFixture();
  const opportunity = (id, opportunityType, overrides = {}) => ({
    id, opportunityType, eligible: true, timestampSeconds: 1, frame: 10,
    contextKey: `2v2:${opportunityType}:first:loose:low:normal`,
    context: { pressure: "low", coverage: "layered", mode: "ranked_doubles", subjectTeam: 0 },
    eventFacts: {}, outcome: {}, ...overrides,
  });
  evidence.decisionContext = {
    schemaVersion: "rocket-league-decision-context@0.2.0",
    opportunities: [
      opportunity("boost:fire", "boost_overfill", { eventFacts: { overfill_amount: 89.25, pad_type: "large" } }),
      opportunity("boost:ok", "boost_overfill", { eventFacts: { overfill_amount: 12.75, pad_type: "small" } }),
      opportunity("boost:abstain", "boost_overfill", { eventFacts: { overfill_amount: 35.7, pad_type: "small" } }),
      opportunity("kickoff:fire", "kickoff_contact", { eventFacts: { kickoff_possession_team_is_team_0: false, outcome: "team_one_win" } }),
      opportunity("kickoff:ok", "kickoff_contact", { eventFacts: { kickoff_possession_team_is_team_0: true, outcome: "team_zero_win" } }),
      opportunity("giveaway:fire", "possession_giveaway", { eventFacts: { tags: [{ group: "action", value: "control" }] }, outcome: { nextTeam: "opponent", nextEventSeconds: 1 } }),
      opportunity("giveaway:ok", "possession_giveaway", { outcome: { nextTeam: "subject_team", nextEventSeconds: 1 } }),
      opportunity("giveaway:abstain", "possession_giveaway", { context: { pressure: "high" }, outcome: { nextTeam: "opponent" } }),
      opportunity("center:fire", "offense_center_outcome", { outcome: { nextTeam: "opponent", nextEventSeconds: 1 } }),
      opportunity("center:ok", "offense_center_outcome", { outcome: { nextTeam: "subject_team", nextEventSeconds: 1 } }),
      opportunity("clear:fire", "defensive_clear_outcome", { eventFacts: { tags: [{ group: "action", value: "clear" }] }, outcome: { nextTeam: "opponent" } }),
      opportunity("clear:ok", "defensive_clear_outcome", { outcome: { nextTeam: "subject_team" } }),
    ],
  };
  evidence.adaptiveSampling = { summary: { windowCount: 0, retainedFrameCount: 0, eventTypes: {} } };
  const result = runShadowDetectors(evidence);
  for (const detectorId of ["boost.overfill", "kickoff.contact", "possession.giveaway", "offense.center_to_opponent", "defense.clear_direction"]) {
    const run = result.runs.find((item) => item.detectorId === detectorId);
    assert.equal(run.candidateCount, 1, detectorId);
    assert.ok(run.opportunityContract.summary.nonFiringOpportunities >= 1, detectorId);
  }
  assert.equal(result.runs.find((item) => item.detectorId === "boost.overfill").opportunityContract.summary.abstainedOpportunities, 1);
  assert.equal(result.runs.find((item) => item.detectorId === "possession.giveaway").opportunityContract.summary.abstainedOpportunities, 1);
});

test("tactical layer detectors share explicit challenge and defensive commitment denominators", () => {
  const evidence = evidenceFixture();
  const opportunity = (id, opportunityType, context, outcome, subject = { boostPercent: 50 }) => ({
    id, opportunityType, eligible: true, timestampSeconds: 2, frame: 20,
    contextKey: `2v2:${opportunityType}:${id}`,
    context: { mode: "2v2", pressure: "low", coverage: "layered", fieldZone: "own_half", defensiveRole: "front_layer", ...context },
    eventFacts: {}, outcome, subject,
  });
  evidence.decisionContext = {
    schemaVersion: "rocket-league-decision-context@0.4.0",
    opportunities: [
      opportunity("challenge:risk", "challenge_quality", { coverage: "exposed", defensiveRole: "last_layer", opponentAccessMarginSeconds: -0.2 }, { nextTeam: "opponent" }),
      opportunity("challenge:safe", "challenge_quality", { coverage: "layered", defensiveRole: "front_layer" }, { nextTeam: "subject_team" }),
      opportunity("commit:risk", "defensive_commitment", { defensiveRole: "last_layer", subjectAheadOfBall: true, pressure: "high", opponentAccessMarginSeconds: -0.2 }, { nextTeam: "opponent" }, { boostPercent: 10 }),
      opportunity("commit:safe", "defensive_commitment", { defensiveRole: "front_layer", subjectAheadOfBall: false }, { nextTeam: "subject_team" }, { boostPercent: 60 }),
    ],
  };
  const result = runShadowDetectors(evidence);
  for (const detectorId of ["challenge.teammate_coverage", "challenge.last_player", "rotation.third_overextension", "boost.defensive_reserve"]) {
    const run = result.runs.find((item) => item.detectorId === detectorId);
    assert.equal(run.candidateCount, 1, detectorId);
    assert.equal(run.opportunityContract.summary.firingOpportunities, 1, detectorId);
    assert.equal(run.opportunityContract.summary.nonFiringOpportunities, 1, detectorId);
    assert.equal(run.opportunityContract.summary.integrityPassed, true, detectorId);
  }
});

test("eight legacy telemetry lanes now retain firing, non-firing and abstained denominators", () => {
  const evidence = evidenceFixture();
  const opportunity = (id, opportunityType, overrides = {}) => ({
    id, opportunityType, eligible: true, timestampSeconds: 2, frame: 20,
    contextKey: `2v2:${opportunityType}:${id}`,
    context: { mode: "2v2", subjectTeam: 0, pressure: "low", coverage: "layered", ...overrides.context },
    eventFacts: overrides.eventFacts ?? {}, outcome: overrides.outcome ?? {}, subject: overrides.subject ?? {},
    sourceEventType: overrides.sourceEventType ?? "frame_episode",
  });
  evidence.decisionContext = {
    schemaVersion: "rocket-league-decision-context@0.5.0",
    opportunities: [
      opportunity("zero:fire", "zero_boost_exposure", { eventFacts: { duration_seconds: 0.8 } }),
      opportunity("zero:ok", "zero_boost_exposure", { eventFacts: { duration_seconds: 0.1 } }),
      opportunity("zero:abstain", "zero_boost_exposure", { eventFacts: { duration_seconds: 0.35 } }),
      opportunity("press:fire", "boost_press_efficiency", { eventFacts: { boost_spent_percent: 8, supersonic_fraction: 1, speed_gain: 20 } }),
      opportunity("press:ok", "boost_press_efficiency", { eventFacts: { boost_spent_percent: 8, supersonic_fraction: 0.1, speed_gain: 300 } }),
      opportunity("press:abstain", "boost_press_efficiency", { eventFacts: { boost_spent_percent: 8, supersonic_fraction: 0.5, speed_gain: 100 } }),
      opportunity("speed:fire", "kickoff_speed", { eventFacts: { team_zero_taker: { time_to_ball: 2.4, spawn_position: "diagonal_left" } } }),
      opportunity("speed:ok", "kickoff_speed", { eventFacts: { team_zero_taker: { time_to_ball: 2, spawn_position: "diagonal_left" } } }),
      opportunity("speed:abstain", "kickoff_speed", { eventFacts: { team_zero_taker: { time_to_ball: 2.3, spawn_position: "diagonal_left" } } }),
      opportunity("touch:fire", "first_touch_quality", { eventFacts: { tags: [{ group: "action", value: "boom" }], ball_speed_change: 2000 }, outcome: { nextTeam: "opponent" } }),
      opportunity("touch:ok", "first_touch_quality", { outcome: { nextTeam: "subject_team" } }),
      opportunity("touch:abstain", "first_touch_quality", { outcome: { nextTeam: "unknown" } }),
      opportunity("dive:fire", "challenge_dive", { sourceEventType: "whiff", context: { mode: "2v2", coverage: "exposed" }, eventFacts: { kind: "beaten_to_ball" }, outcome: { nextTeam: "opponent" } }),
      opportunity("dive:ok", "challenge_dive", { sourceEventType: "fifty_fifty" }),
      opportunity("dive:abstain", "challenge_dive", { sourceEventType: "whiff", eventFacts: { kind: "miss" }, outcome: { nextTeam: "unknown" } }),
      opportunity("spacing:fire", "team_spacing_decision", { context: { nearestTeammateDistanceToSubject: 800, sameLaneTeammates: 1, teammateAccessMarginSeconds: 0.1 } }),
      opportunity("spacing:ok", "team_spacing_decision", { context: { nearestTeammateDistanceToSubject: 1600, sameLaneTeammates: 0, teammateAccessMarginSeconds: 1 } }),
      opportunity("spacing:abstain", "team_spacing_decision", { context: { nearestTeammateDistanceToSubject: 800, sameLaneTeammates: 1, teammateAccessMarginSeconds: 1 } }),
      opportunity("commit:fire", "team_commitment_decision", { context: { nearestTeammateDistanceToBall: 700, subjectTowardBall: 500, nearestTeammateTowardBall: 500, sameLaneTeammates: 1, teammateAccessMarginSeconds: 0.1 }, subject: { distanceToBall: 700 } }),
      opportunity("commit:ok", "team_commitment_decision", { context: { nearestTeammateDistanceToBall: 1800, subjectTowardBall: 500, nearestTeammateTowardBall: 200, sameLaneTeammates: 0, teammateAccessMarginSeconds: 1 }, subject: { distanceToBall: 700 } }),
      opportunity("commit:abstain", "team_commitment_decision", { context: { nearestTeammateDistanceToBall: 1100, subjectTowardBall: 500, nearestTeammateTowardBall: 500, sameLaneTeammates: 1, teammateAccessMarginSeconds: 0.3 }, subject: { distanceToBall: 700 } }),
      opportunity("momentum:fire", "recovery_reentry", { outcome: { timeToUsefulSpeed: 1.3, peakSpeed: 1200 }, subject: { distanceToBall: 2200 } }),
      opportunity("momentum:ok", "recovery_reentry", { outcome: { timeToUsefulSpeed: 0.5, peakSpeed: 1500 }, subject: { distanceToBall: 2200 } }),
      opportunity("momentum:abstain", "recovery_reentry", { outcome: { timeToUsefulSpeed: 1, peakSpeed: 1300 }, subject: { distanceToBall: 2200 } }),
    ],
  };
  const result = runShadowDetectors(evidence);
  for (const detectorId of [
    "boost.zero_duration", "boost.supersonic_waste", "kickoff.speed", "possession.first_touch",
    "challenge.dive", "rotation.spacing_too_close", "teamplay.double_commit", "recovery.momentum_loss",
  ]) {
    const summary = result.runs.find((run) => run.detectorId === detectorId).opportunityContract.summary;
    assert.equal(summary.firingOpportunities, 1, detectorId);
    assert.equal(summary.nonFiringOpportunities, 1, detectorId);
    assert.equal(summary.abstainedOpportunities, 1, detectorId);
    assert.equal(summary.integrityPassed, true, detectorId);
  }
});

test("mechanics lanes preserve explicit firing, non-firing and abstained denominators", () => {
  const evidence = evidenceFixture();
  const opportunity = (id, opportunityType, eventFacts, overrides = {}) => ({
    id, opportunityType, eligible: true, timestampSeconds: 1, frame: 10,
    contextKey: `2v2:${opportunityType}:${id}`,
    context: { mode: "2v2", pressure: "low", coverage: "layered" },
    eventFacts,
    outcome: {},
    ...overrides,
  });
  evidence.decisionContext = {
    schemaVersion: "rocket-league-decision-context@0.6.0",
    opportunities: [
      opportunity("landing:fire", "landing_execution", { uprightDeviationDegrees: 45, forwardToVelocityDegrees: 120, timeToUsefulSpeed: 1.2 }),
      opportunity("landing:ok", "landing_execution", { uprightDeviationDegrees: 5, forwardToVelocityDegrees: 20, timeToUsefulSpeed: 0.5 }),
      opportunity("landing:abstain", "landing_execution", { uprightDeviationDegrees: 20, forwardToVelocityDegrees: 60, timeToUsefulSpeed: 0.9 }),
      opportunity("aerial:fire", "post_aerial_exit", { timeToUsefulSpeed: 1.3, timeToStableHeading: 1 }),
      opportunity("aerial:ok", "post_aerial_exit", { timeToUsefulSpeed: 0.5, timeToStableHeading: 0.3 }),
      opportunity("aerial:abstain", "post_aerial_exit", { timeToUsefulSpeed: 0.9, timeToStableHeading: 0.7 }),
      opportunity("wall-exit:fire", "wall_to_ground_transition", { wallToGroundSeconds: 0.9, timeToUsefulSpeed: 1.2 }),
      opportunity("wall-exit:ok", "wall_to_ground_transition", { wallToGroundSeconds: 0.3, timeToUsefulSpeed: 0.5 }),
      opportunity("wall-exit:abstain", "wall_to_ground_transition", { wallToGroundSeconds: 0.5, timeToUsefulSpeed: 0.9 }),
      opportunity("control:fire", "touch_control_execution", { postTouchCloseControlFraction: 0.1, postTouchMedianDistanceToBall: 800 }, { outcome: { nextTeam: "opponent", nextEventSeconds: 1 } }),
      opportunity("control:ok", "touch_control_execution", { postTouchCloseControlFraction: 0.8, postTouchMedianDistanceToBall: 200 }, { outcome: { nextTeam: "subject_team", nextEventSeconds: 1 } }),
      opportunity("control:abstain", "touch_control_execution", { postTouchCloseControlFraction: 0.1, postTouchMedianDistanceToBall: 800 }, { context: { pressure: "high" }, outcome: { nextTeam: "opponent", nextEventSeconds: 1 } }),
      opportunity("wall-control:fire", "wall_control_execution", { postTouchCloseControlFraction: 0.1, postTouchMedianDistanceToBall: 850 }, { outcome: { nextTeam: "opponent", nextEventSeconds: 1 } }),
      opportunity("wall-control:ok", "wall_control_execution", { postTouchCloseControlFraction: 0.7, postTouchMedianDistanceToBall: 250 }, { outcome: { nextTeam: "subject_team", nextEventSeconds: 1 } }),
      opportunity("wall-control:abstain", "wall_control_execution", { postTouchCloseControlFraction: 0.3, postTouchMedianDistanceToBall: 500 }, { outcome: { nextTeam: "unknown" } }),
    ],
  };
  const result = runShadowDetectors(evidence);
  for (const detectorId of [
    "recovery.landing_orientation", "recovery.post_aerial_exit", "recovery.wall_to_ground",
    "possession.control_space", "possession.wall_control",
  ]) {
    const summary = result.runs.find((run) => run.detectorId === detectorId).opportunityContract.summary;
    assert.equal(summary.firingOpportunities, 1, detectorId);
    assert.equal(summary.nonFiringOpportunities, 1, detectorId);
    assert.equal(summary.abstainedOpportunities, 1, detectorId);
    assert.equal(summary.integrityPassed, true, detectorId);
  }
});
