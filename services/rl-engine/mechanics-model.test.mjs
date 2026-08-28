import assert from "node:assert/strict";
import test from "node:test";
import { buildMechanicsModel, mechanicsModelSummary, MECHANICS_MODEL_VERSION } from "./mechanics-model.mjs";

function frame(index, overrides = {}) {
  const timeSeconds = index / 30;
  const airborne = timeSeconds >= 0.7 && timeSeconds < 1;
  const position = airborne ? { x: 0, y: 0, z: 160 } : { x: timeSeconds * 500, y: 0, z: 17 };
  return {
    index,
    timeSeconds,
    ball: {
      position: { x: 600, y: 0, z: 100 },
      linearVelocity: { x: 300, y: 0, z: 0 },
    },
    players: [{
      id: "epic:subject",
      team: 0,
      distanceToBall: timeSeconds < 0.8 ? 250 : 800,
      position,
      rotation: airborne ? { x: 0.2, y: 0.1, z: 0 } : { x: 0, y: 0, z: 0 },
      linearVelocity: airborne ? { x: 700, y: 0, z: -500 } : { x: timeSeconds >= 1 ? 1_100 : 800, y: 0, z: 0 },
      angularVelocity: { x: 0.1, y: 0.1, z: 0.1 },
      ...overrides,
    }],
  };
}

test("builds replay-visible touch and recovery mechanics without inferring controller inputs", () => {
  const detailFrames = Array.from({ length: 61 }, (_, index) => frame(index));
  const macroFrames = detailFrames.filter((_, index) => index % 3 === 0);
  const model = buildMechanicsModel({
    normalized: { subjectPlayerId: "epic:subject" },
    frameState: { frames: macroFrames },
    episodeTimeline: {
      events: [
        {
          id: "touch:one", type: "touch", playerId: "epic:subject", subjectInvolved: true,
          startTimeSeconds: 0.5, startFrame: 15,
          facts: { tags: [{ group: "action", value: "control" }] },
        },
        { id: "dodge:one", type: "dodge", playerId: "epic:subject", subjectInvolved: true, startTimeSeconds: 0.8 },
      ],
    },
    adaptiveSampling: {
      detailSampleRateHz: 30,
      detailFrames,
      windows: [{ eventId: "touch:one", sampleRateHz: 30, frameIndexes: detailFrames.map((item) => item.index) }],
    },
  });

  assert.equal(model.schemaVersion, MECHANICS_MODEL_VERSION);
  assert.equal(model.publicationStatus, "private_shadow");
  assert.match(model.measurementBasis.causalBoundary, /does not infer controller inputs/i);
  assert.equal(model.touches.length, 1);
  assert.equal(model.touches[0].eligible, true);
  assert.equal(model.touches[0].observedAction, "control");
  assert.ok(Number.isFinite(model.touches[0].metrics.relativeCarBallSpeed));
  assert.equal(model.recoveries.length, 1);
  assert.equal(model.recoveries[0].sourceSurface, "aerial");
  assert.ok(model.recoveries[0].metrics.timeToUsefulSpeed <= 0.1);
  assert.equal(model.summary.executionEventCounts.dodge, 1);
  assert.equal(mechanicsModelSummary(model).eligibleRecoveryEpisodes, 1);
});

test("abstains when a touch has no retained high-rate source window", () => {
  const frames = Array.from({ length: 20 }, (_, index) => frame(index));
  const model = buildMechanicsModel({
    normalized: { subjectPlayerId: "epic:subject" },
    frameState: { frames },
    episodeTimeline: {
      events: [{ id: "touch:missing", type: "touch", playerId: "epic:subject", subjectInvolved: true, startTimeSeconds: 0.3 }],
    },
    adaptiveSampling: { detailSampleRateHz: 30, detailFrames: frames, windows: [] },
  });
  assert.equal(model.touches[0].eligible, false);
  assert.deepEqual(model.touches[0].abstainReasons, ["detail_window_unavailable"]);
});
