export const TACTICAL_SPATIAL_VERSION = "rocket-league-tactical-spatial@0.2.0";
export const ACCESS_BASIS = "kinematic_intercept_proxy_v1";

export function distance3d(a, b) {
  if (![a?.x, a?.y, a?.z, b?.x, b?.y, b?.z].every(Number.isFinite)) return null;
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function speed3d(velocity) {
  if (![velocity?.x, velocity?.y, velocity?.z].every(Number.isFinite)) return null;
  return Math.hypot(velocity.x, velocity.y, velocity.z);
}

export function movingToward(player, target) {
  const position = player?.position;
  const velocity = player?.linearVelocity;
  if (![position?.x, position?.y, position?.z, velocity?.x, velocity?.y, velocity?.z, target?.x, target?.y, target?.z].every(Number.isFinite)) return null;
  const dx = target.x - position.x;
  const dy = target.y - position.y;
  const dz = target.z - position.z;
  const distance = Math.hypot(dx, dy, dz);
  if (!distance) return 0;
  return (velocity.x * dx + velocity.y * dy + velocity.z * dz) / distance;
}

function reachableDistance(initialSpeed, acceleration, seconds) {
  const speed = Math.min(2300, Math.max(0, initialSpeed));
  const accelerationTime = Math.max(0, (2300 - speed) / acceleration);
  if (seconds <= accelerationTime) return (speed * seconds) + (0.5 * acceleration * seconds ** 2);
  return (speed * accelerationTime) + (0.5 * acceleration * accelerationTime ** 2) + (2300 * (seconds - accelerationTime));
}

/**
 * A deterministic comparison proxy, not a Rocket League physics prediction.
 * It accounts for current velocity direction, finite acceleration, boost
 * availability, ball linear motion and a bounded turn/height penalty.
 */
export function estimateInterceptProxySeconds(player, ball, horizonSeconds = 4) {
  if (!player?.position || !ball?.position) return null;
  const baseDistance = distance3d(player.position, ball.position);
  if (!Number.isFinite(baseDistance)) return null;
  const toward = movingToward(player, ball.position);
  const initialTowardSpeed = Math.max(0, Number.isFinite(toward) ? toward : 0);
  const boostPercent = Number.isFinite(player.boostPercent) ? player.boostPercent : 0;
  const acceleration = boostPercent >= 5 ? 1400 : 1000;
  const turnPenalty = !Number.isFinite(toward) ? 0.2 : toward < -200 ? 0.4 : toward < 250 ? 0.2 : 0;
  const heightPenalty = Math.max(0, (Number(ball.position.z) - 180) / 900);
  const velocity = ball.linearVelocity ?? { x: 0, y: 0, z: 0 };
  for (let seconds = 0.1; seconds <= horizonSeconds + 1e-9; seconds += 0.1) {
    const futureBall = {
      x: ball.position.x + (Number.isFinite(velocity.x) ? velocity.x * seconds : 0),
      y: ball.position.y + (Number.isFinite(velocity.y) ? velocity.y * seconds : 0),
      z: Math.max(0, ball.position.z + (Number.isFinite(velocity.z) ? velocity.z * seconds : 0)),
    };
    const needed = distance3d(player.position, futureBall);
    if (Number.isFinite(needed) && reachableDistance(initialTowardSpeed, acceleration, seconds) >= needed) {
      return Math.round((seconds + turnPenalty + heightPenalty) * 1000) / 1000;
    }
  }
  return null;
}

function ownGoalY(team) {
  return team === 0 ? -5120 : team === 1 ? 5120 : null;
}

function attackingAhead(subjectY, ballY, team) {
  if (![subjectY, ballY].every(Number.isFinite)) return null;
  if (team === 0) return subjectY > ballY;
  if (team === 1) return subjectY < ballY;
  return null;
}

function fieldZone(ballY, team) {
  if (!Number.isFinite(ballY) || ![0, 1].includes(team)) return "unknown";
  const attackingCoordinate = team === 0 ? ballY : -ballY;
  if (attackingCoordinate <= -1700) return "own_third";
  if (attackingCoordinate < 0) return "own_half";
  if (attackingCoordinate < 1700) return "opponent_half";
  return "opponent_third";
}

export function buildTacticalSpatialState(frame, subjectId) {
  const normalizedId = String(subjectId ?? "").toLowerCase();
  const subject = frame?.players?.find((player) => player.id.toLowerCase() === normalizedId);
  if (!subject || !frame?.ball?.position) return { eligible: false, reason: "subject_or_ball_frame_missing", schemaVersion: TACTICAL_SPATIAL_VERSION };
  const teammates = frame.players.filter((player) => player.team === subject.team && player.id.toLowerCase() !== normalizedId);
  const opponents = frame.players.filter((player) => player.team !== subject.team);
  const teamPlayers = [subject, ...teammates];
  const access = teamPlayers.map((player) => ({
    id: player.id.toLowerCase(),
    distance: Number.isFinite(player.distanceToBall) ? player.distanceToBall : distance3d(player.position, frame.ball.position),
    interceptSeconds: estimateInterceptProxySeconds(player, frame.ball),
  })).filter((item) => Number.isFinite(item.distance)).sort((left, right) => (
    (left.interceptSeconds ?? Infinity) - (right.interceptSeconds ?? Infinity)
    || left.distance - right.distance
    || left.id.localeCompare(right.id)
  ));
  const subjectAccessIndex = access.findIndex((item) => item.id === normalizedId);
  const subjectAccess = access[subjectAccessIndex];
  const teammateAccess = access.filter((item) => item.id !== normalizedId);
  const accessOrder = subjectAccessIndex < 0 ? "unknown"
    : subjectAccessIndex === 0 ? "first"
      : subjectAccessIndex === access.length - 1 ? "last" : "second";
  const role = teammates.length === 0 ? "solo" : accessOrder === "first" ? "first" : accessOrder === "last" ? "safety" : "support";

  const opponentAccess = opponents.map((player) => ({
    id: player.id.toLowerCase(),
    distance: Number.isFinite(player.distanceToBall) ? player.distanceToBall : distance3d(player.position, frame.ball.position),
    interceptSeconds: estimateInterceptProxySeconds(player, frame.ball),
  })).filter((item) => Number.isFinite(item.distance)).sort((left, right) => (
    (left.interceptSeconds ?? Infinity) - (right.interceptSeconds ?? Infinity) || left.distance - right.distance
  ));

  const goalY = ownGoalY(subject.team);
  const ballGoalDistance = Number.isFinite(goalY) ? Math.abs(frame.ball.position.y - goalY) : null;
  const goalSideTeammates = teammates.filter((player) => Number.isFinite(player.position?.y)
    && Number.isFinite(ballGoalDistance) && Math.abs(player.position.y - goalY) < ballGoalDistance).length;
  const subjectGoalSide = Number.isFinite(subject.position?.y) && Number.isFinite(ballGoalDistance)
    ? Math.abs(subject.position.y - goalY) < ballGoalDistance : null;
  const defensiveOrder = teamPlayers.filter((player) => Number.isFinite(player.position?.y) && Number.isFinite(goalY))
    .sort((left, right) => Math.abs(left.position.y - goalY) - Math.abs(right.position.y - goalY) || left.id.localeCompare(right.id));
  const defensiveIndex = defensiveOrder.findIndex((player) => player.id.toLowerCase() === normalizedId);
  const defensiveRole = teammates.length === 0 ? "solo"
    : defensiveIndex === 0 ? "last_layer"
      : defensiveIndex === defensiveOrder.length - 1 ? "front_layer" : "middle_layer";
  const sameLaneTeammates = teammates.filter((player) => Number.isFinite(player.position?.x)
    && Number.isFinite(player.position?.y)
    && Math.abs(player.position.x - subject.position.x) <= 900
    && Math.abs(player.position.y - subject.position.y) <= 1600).length;
  const teammateGeometry = teammates.map((player) => ({
    id: player.id.toLowerCase(),
    distanceToSubject: distance3d(player.position, subject.position),
    distanceToBall: Number.isFinite(player.distanceToBall) ? player.distanceToBall : distance3d(player.position, frame.ball.position),
    towardBall: movingToward(player, frame.ball.position),
  })).sort((left, right) => (left.distanceToBall ?? Infinity) - (right.distanceToBall ?? Infinity) || left.id.localeCompare(right.id));
  const nearestTeammateToBall = teammateGeometry[0] ?? null;
  const nearestTeammateDistanceToSubject = teammateGeometry.map((item) => item.distanceToSubject)
    .filter(Number.isFinite).sort((left, right) => left - right)[0] ?? null;
  // Preserve geometric pressure as its own stable primitive. Intercept order is
  // exported separately and must not silently redefine this distance band.
  const nearestOpponentDistance = opponents.map((player) => distance3d(player.position, frame.ball.position))
    .filter(Number.isFinite).sort((left, right) => left - right)[0] ?? null;
  const pressure = !Number.isFinite(nearestOpponentDistance) ? "unknown"
    : nearestOpponentDistance <= 1200 ? "high" : nearestOpponentDistance <= 2200 ? "medium" : "low";

  return {
    schemaVersion: TACTICAL_SPATIAL_VERSION,
    eligible: true,
    subject,
    teammateCount: teammates.length,
    accessOrder,
    accessBasis: ACCESS_BASIS,
    subjectTimeToBallProxySeconds: subjectAccess?.interceptSeconds ?? null,
    nextTeammateTimeToBallProxySeconds: access.find((item) => item.id !== normalizedId)?.interceptSeconds ?? null,
    teammateAccessMarginSeconds: Number.isFinite(subjectAccess?.interceptSeconds) && Number.isFinite(teammateAccess[0]?.interceptSeconds)
      ? Math.round((teammateAccess[0].interceptSeconds - subjectAccess.interceptSeconds) * 1000) / 1000 : null,
    nearestOpponentTimeToBallProxySeconds: opponentAccess[0]?.interceptSeconds ?? null,
    subjectOpponentAccessMarginSeconds: Number.isFinite(subjectAccess?.interceptSeconds) && Number.isFinite(opponentAccess[0]?.interceptSeconds)
      ? Math.round((opponentAccess[0].interceptSeconds - subjectAccess.interceptSeconds) * 1000) / 1000 : null,
    role,
    defensiveRole,
    defensiveLayerIndex: defensiveIndex >= 0 ? defensiveIndex : null,
    subjectGoalSide,
    subjectAheadOfBall: attackingAhead(subject.position?.y, frame.ball.position.y, subject.team),
    fieldZone: fieldZone(frame.ball.position.y, subject.team),
    goalSideTeammates,
    coverage: teammates.length === 0 ? "not_applicable" : goalSideTeammates > 0 ? "layered" : "exposed",
    sameLaneTeammates,
    nearestTeammateDistanceToSubject,
    nearestTeammateDistanceToBall: nearestTeammateToBall?.distanceToBall ?? null,
    nearestTeammateTowardBall: nearestTeammateToBall?.towardBall ?? null,
    subjectTowardBall: movingToward(subject, frame.ball.position),
    nearestOpponentDistance,
    pressure,
  };
}
