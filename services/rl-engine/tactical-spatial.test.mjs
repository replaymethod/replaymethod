import assert from "node:assert/strict";
import test from "node:test";
import { ACCESS_BASIS, buildTacticalSpatialState, estimateInterceptProxySeconds } from "./tactical-spatial.mjs";

const player = (id, team, x, y, vx, boostPercent = 50) => ({
  id, team, distanceToBall: Math.hypot(x, y), boostPercent,
  position: { x, y, z: 17 }, linearVelocity: { x: vx, y: 0, z: 0 },
});

test("kinematic access proxy rewards a closer aligned player and labels its limits", () => {
  const ball = { position: { x: 0, y: 0, z: 100 }, linearVelocity: { x: 0, y: 0, z: 0 } };
  const close = player("subject", 0, -500, 0, 900);
  const far = player("mate", 0, -1800, 0, 900);
  assert.ok(estimateInterceptProxySeconds(close, ball) < estimateInterceptProxySeconds(far, ball));
  const state = buildTacticalSpatialState({ ball, players: [close, far, player("opponent", 1, 1200, 0, -500)] }, "subject");
  assert.equal(state.accessBasis, ACCESS_BASIS);
  assert.equal(state.accessOrder, "first");
  assert.equal(state.role, "first");
  assert.equal(state.defensiveRole, "front_layer");
});

test("spatial state identifies last layer, goal-side coverage and lane overlap", () => {
  const ball = { position: { x: 0, y: 1200, z: 100 }, linearVelocity: { x: 0, y: -300, z: 0 } };
  const subject = player("subject", 0, 0, -3000, 400);
  const mate = player("mate", 0, 400, -1800, 1000);
  const state = buildTacticalSpatialState({ ball, players: [subject, mate, player("opponent", 1, 0, 500, -800)] }, "subject");
  assert.equal(state.defensiveRole, "last_layer");
  assert.equal(state.subjectGoalSide, true);
  assert.equal(state.coverage, "layered");
  assert.equal(state.sameLaneTeammates, 1);
  assert.ok(Number.isFinite(state.nearestTeammateDistanceToSubject));
  assert.ok(Number.isFinite(state.nearestTeammateDistanceToBall));
  assert.ok(Number.isFinite(state.subjectTowardBall));
  assert.ok(Number.isFinite(state.nearestTeammateTowardBall));
  assert.equal(state.fieldZone, "opponent_half");
});
