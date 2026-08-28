import assert from "node:assert/strict";
import test from "node:test";
import { ROCKET_LEAGUE_DETECTOR_CATALOG } from "./detector-catalog.mjs";
import { EXPANDED_MEASURING_DETECTORS } from "./expanded-detectors.mjs";

const opportunityTypes = [
  "zero_boost_exposure", "boost_route_pickup", "rotation_transition", "team_support_decision",
  "defensive_positioning", "tactical_challenge", "demolition_reentry", "recovery_reentry",
  "possession_clear", "possession_sequence", "shot_execution", "tactical_touch", "shot_follow_up",
  "attack_creation", "defensive_shadow", "post_save_recovery", "kickoff_support",
];

function opportunity(type, index) {
  return {
    id: `${type}:${index}`,
    opportunityType: type,
    eligible: true,
    timestampSeconds: index,
    frame: index * 10,
    sourceEventType: type === "tactical_challenge" ? "whiff" : "touch",
    contextKey: `2v2:${type}:test`,
    context: {
      mode: "2v2", subjectTeam: 0, pressure: "low", possession: "team_control",
      fieldZone: "opponent_half", coverage: "layered", accessOrder: "first",
      teammateAccessMarginSeconds: 0.8, opponentAccessMarginSeconds: 0.5,
      nearestTeammateDistanceToSubject: 1800, nearestTeammatePosition: { x: -1500, y: -500, z: 17 },
      sameLaneTeammates: 0, subjectGoalSide: true, subjectAheadOfBall: false,
      subjectDistanceToOwnGoal: 3200, nearestOpponentDistance: 1800, opponentCount: 2,
      riskAppetite: "balanced", clock: "normal", score: "tied",
    },
    subject: { distanceToBall: 900, position: { x: 900, y: 500, z: 17 } },
    ball: { position: { x: 0, y: 1000, z: 100 } },
    eventFacts: {
      duration_seconds: 0.1, pad_type: "small", boost_before: 20, overfill_amount: 0,
      touch_count: 2, duration: 3, sustained_control: true,
      tags: [{ group: "action", value: "pass" }],
      team_zero_non_takers: [{ player: { Epic: "subject" }, support_behavior: "cheat", start_distance_from_center: 3000 }],
      kickoff_possession_team_is_team_0: true,
    },
    outcome: { nextTeam: "subject_team", nextEventSeconds: 1, goalWithinWindow: false, timeToUsefulSpeed: 0.5, peakSpeed: 1600 },
  };
}

test("all 35 expanded lanes own a real opportunity contract and catalog id", () => {
  assert.equal(EXPANDED_MEASURING_DETECTORS.length, 35);
  const catalogIds = new Set(ROCKET_LEAGUE_DETECTOR_CATALOG.map((entry) => entry.id));
  const evidence = {
    normalized: { subjectPlayerId: "epic:subject", mode: "Ranked Doubles" },
    decisionContext: {
      schemaVersion: "rocket-league-decision-context@0.8.0",
      subjectPlayerId: "epic:subject",
      opportunities: opportunityTypes.map(opportunity),
    },
  };
  for (const detector of EXPANDED_MEASURING_DETECTORS) {
    assert.ok(catalogIds.has(detector.id), detector.id);
    const result = detector.evaluate(evidence);
    assert.equal(result.opportunityContract.detectorId, detector.id);
    assert.ok(result.opportunityContract.summary.totalOpportunities >= 1, detector.id);
    assert.equal(result.opportunityContract.summary.integrityPassed, true, detector.id);
  }
});

test("low-probability aerial lane retains firing, non-firing and abstained high-tail decisions", () => {
  const detector = EXPANDED_MEASURING_DETECTORS.find((entry) => entry.id === "challenge.low_probability_aerial");
  const base = opportunity("tactical_challenge", 1);
  const evidence = {
    normalized: { subjectPlayerId: "epic:subject", mode: "Ranked Doubles" },
    decisionContext: {
      schemaVersion: "rocket-league-decision-context@0.8.0",
      subjectPlayerId: "epic:subject",
      opportunities: [
        { ...base, id: "aerial:fire", eventFacts: { aerial: true, closest_approach_distance: 205, approach_speed: 1800 }, context: { ...base.context, coverage: "exposed" }, outcome: { nextTeam: "opponent", nextEventSeconds: 0.5 } },
        { ...base, id: "aerial:ground", eventFacts: { aerial: false, closest_approach_distance: 205 }, outcome: { nextTeam: "opponent" } },
        { ...base, id: "aerial:abstain", eventFacts: { aerial: true, closest_approach_distance: 150 }, context: { ...base.context, coverage: "layered" }, outcome: { nextTeam: "opponent" } },
      ],
    },
  };
  const result = detector.evaluate(evidence).opportunityContract.summary;
  assert.equal(result.firingOpportunities, 1);
  assert.equal(result.nonFiringOpportunities, 1);
  assert.equal(result.abstainedOpportunities, 1);
  assert.equal(result.integrityPassed, true);
});
