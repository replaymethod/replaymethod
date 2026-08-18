import assert from "node:assert/strict";
import test from "node:test";
import { runShadowDetectors } from "./shadow-runtime.mjs";

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
  };
}

test("executes shadow observations without making them public findings", () => {
  const result = runShadowDetectors(evidenceFixture());
  assert.equal(result.summary.detectorCount, 8);
  assert.equal(result.summary.executed, 8);
  assert.equal(result.summary.errors, 0);
  assert.ok(result.summary.observed >= 4);
  assert.equal(result.summary.publicEligible, 0);

  const boost = result.runs.find((run) => run.detectorId === "boost.zero_duration");
  assert.equal(boost.candidateCount, 1);
  assert.ok(boost.measurements.totalSeconds >= 0.5);
  assert.equal(boost.public, false);

  const kickoff = result.runs.find((run) => run.detectorId === "kickoff.speed");
  assert.equal(kickoff.measurements.meanTimeToBallSeconds, 1.95);

  const touch = result.runs.find((run) => run.detectorId === "possession.first_touch");
  assert.deepEqual(touch.measurements.actionCounts, { boom: 1 });

  const challenge = result.runs.find((run) => run.detectorId === "challenge.dive");
  assert.equal(challenge.measurements.beatenToBall, 1);
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
