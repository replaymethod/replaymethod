import assert from "node:assert/strict";
import test from "node:test";
import { normalizeFrameState } from "./frame-state.mjs";

const headers = {
  global_headers: [
    "current time", "seconds remaining",
    "Ball - position x", "Ball - position y", "Ball - position z",
    "Ball - rotation x", "Ball - rotation y", "Ball - rotation z",
    "Ball - linear velocity x", "Ball - linear velocity y", "Ball - linear velocity z",
    "Ball - angular velocity x", "Ball - angular velocity y", "Ball - angular velocity z",
  ],
  player_headers: [
    "boost level (raw replay units)", "distance to ball",
    "position x", "position y", "position z",
    "rotation x", "rotation y", "rotation z",
    "linear velocity x", "linear velocity y", "linear velocity z",
    "angular velocity x", "angular velocity y", "angular velocity z",
  ],
};

const body = (base) => [
  base, base + 1, base + 2,
  base + 3, base + 4, base + 5,
  base + 6, base + 7, base + 8,
  base + 9, base + 10, base + 11,
];

test("normalizes named frame state for every replay player", () => {
  const frameState = normalizeFrameState({
    metadata: { column_headers: headers },
    array_data: [
      [3.5, 300, ...body(10), 85, 1200, ...body(100), 33, 800, ...body(200)],
      [3.6, 299.9, ...body(20), 84, 1100, ...body(110), 32, 700, ...body(210)],
    ],
  }, {
    team_zero: [{ name: "Blue", remote_id: { Epic: "blue-id" } }],
    team_one: [{ name: "Orange", remote_id: { Steam: "orange-id" } }],
  });

  assert.equal(frameState.schemaVersion, "rocket-league-frame-state.v1");
  assert.equal(frameState.summary.frameCount, 2);
  assert.equal(frameState.summary.playerCount, 2);
  assert.equal(frameState.frames[0].ball.position.x, 10);
  assert.equal(frameState.frames[0].ball.linearVelocity.z, 18);
  assert.equal(frameState.frames[0].players[0].id, "epic:blue-id");
  assert.equal(frameState.frames[0].players[0].boost, 85);
  assert.equal(frameState.frames[0].players[0].position.x, 100);
  assert.equal(frameState.frames[0].players[1].team, 1);
  assert.equal(frameState.frames[0].players[1].angularVelocity.z, 211);
  assert.equal(frameState.summary.coverage.ball, 1);
  assert.equal(frameState.summary.coverage.players, 1);
});

test("rejects a matrix whose width cannot be attributed safely", () => {
  assert.throws(() => normalizeFrameState({
    metadata: { column_headers: headers },
    array_data: [[3.5, 300, ...body(10)]],
  }, {
    team_zero: [{ name: "Blue", remote_id: { Epic: "blue-id" } }],
  }), /matrix width did not match metadata/);
});
