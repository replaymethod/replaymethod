import assert from "node:assert/strict";
import test from "node:test";
import { buildPerformanceSnapshot, PERFORMANCE_SNAPSHOT_VERSION } from "./performance-snapshot.mjs";

function evidence(mode = "Ranked Doubles") {
  const frames = Array.from({ length: 40 }, (_, index) => ({
    index,
    timeSeconds: index / 10,
    secondsRemaining: 300 - (index / 10),
    ball: { position: { x: 0, y: 0, z: 100 } },
    players: [
      { id: "epic:subject", team: 0, boost: index < 5 ? 0 : 127.5, distanceToBall: 2300, position: { x: 1000, y: 0, z: 17 }, linearVelocity: { x: index > 20 ? 2300 : 900, y: 0, z: 0 } },
      { id: "epic:mate", team: 0, boost: 100, distanceToBall: 1200, position: { x: 2500, y: 0, z: 17 }, linearVelocity: { x: 800, y: 0, z: 0 } },
      { id: "epic:opponent", team: 1, boost: 100, distanceToBall: 900, position: { x: -1500, y: 0, z: 17 }, linearVelocity: { x: 700, y: 0, z: 0 } },
    ],
  }));
  return {
    mode,
    meta: {
      all_headers: [["Team0Score", 2], ["Team1Score", 1], ["WinningTeam", 0], ["TotalSecondsPlayed", 301]],
    },
    subject: { id: "epic:subject", name: "Subject", team: 0, raw: { stats: { Score: 420, Goals: 1, Assists: 1, Saves: 2, Shots: 3 } } },
    frameState: { sampleRateHz: 10, frames, summary: { durationSeconds: 3.9, coverage: { ball: 1, players: 1 } } },
    episodeTimeline: {
      phases: [{ livePlay: true, startTimeSeconds: 0, endTimeSeconds: 4 }],
      events: [
        { id: "touch:1", type: "touch", playerId: "epic:subject", subjectInvolved: true, startTimeSeconds: 1, endTimeSeconds: 1, startFrame: 10, endFrame: 10, facts: {} },
        { id: "controlled:1", type: "controlled_play", playerId: "epic:subject", subjectInvolved: true, startTimeSeconds: 2, endTimeSeconds: 3, startFrame: 20, endFrame: 30, facts: { duration: 1, touch_count: 2, start_field_third: "neutral_third" } },
        { id: "possession:1", type: "player_possession", playerId: "epic:subject", subjectInvolved: true, startTimeSeconds: 2, endTimeSeconds: 3, startFrame: 20, endFrame: 30, facts: { duration: 1 } },
        { id: "goal:1", type: "goal_context", playerId: "epic:subject", subjectInvolved: true, startTimeSeconds: 3, endTimeSeconds: 3, startFrame: 30, endFrame: 30, facts: { scorer: { Epic: "subject" }, scoring_team_is_team_0: true } },
      ],
    },
  };
}

test("builds a traceable multi-category snapshot for every valid team replay", () => {
  const snapshot = buildPerformanceSnapshot(evidence());
  assert.equal(snapshot.version, PERFORMANCE_SNAPSHOT_VERSION);
  assert.deepEqual(snapshot.match, { teamScore: 2, opponentScore: 1, result: "win", overtime: false, durationSeconds: 301, subjectTeam: 0 });
  assert.ok(snapshot.metrics.length >= 5);
  assert.ok(new Set(snapshot.metrics.map((metric) => metric.category)).size >= 3);
  assert.ok(snapshot.metrics.every((metric) => metric.whatHappened && metric.whyItMatters && metric.limitation && metric.source && metric.version));
  assert.ok(snapshot.metrics.some((metric) => metric.id === "nearest_teammate_distance"));
  assert.equal(snapshot.strength.title, "Defensive contribution");
  assert.equal(snapshot.moments[0].title, "Your goal changed the scoreline");
});

test("removes teammate metrics from 1v1 without reducing the universal snapshot", () => {
  const snapshot = buildPerformanceSnapshot(evidence("Ranked Duel"));
  assert.equal(snapshot.metrics.some((metric) => metric.id === "nearest_teammate_distance"), false);
  assert.ok(snapshot.metrics.length >= 5);
  assert.ok(new Set(snapshot.metrics.map((metric) => metric.category)).size >= 3);
});

test("fails closed instead of turning missing player telemetry into zero-valued performance", () => {
  const input = evidence("Ranked Duel");
  input.frameState.frames = [];
  assert.throws(
    () => buildPerformanceSnapshot(input),
    (error) => error?.code === "performance_snapshot_insufficient_telemetry",
  );
});
