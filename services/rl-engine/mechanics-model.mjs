export const MECHANICS_MODEL_VERSION = "rocket-league-mechanics-model@0.1.0";

const GROUND_Z_MAX = 40;
const AERIAL_Z_MIN = 80;
const SIDE_WALL_X_MIN = 3_850;
const BACK_WALL_Y_MIN = 4_850;
const MAX_CONTIGUOUS_GAP_SECONDS = 0.12;

function magnitude(vector, axes = ["x", "y", "z"]) {
  const values = axes.map((axis) => vector?.[axis]);
  return values.every(Number.isFinite)
    ? Math.sqrt(values.reduce((sum, value) => sum + (value * value), 0))
    : null;
}

function subtract(left, right) {
  if (![left?.x, left?.y, left?.z, right?.x, right?.y, right?.z].every(Number.isFinite)) return null;
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}

function angleDegrees(left, right, axes = ["x", "y", "z"]) {
  const leftMagnitude = magnitude(left, axes);
  const rightMagnitude = magnitude(right, axes);
  if (!Number.isFinite(leftMagnitude) || !Number.isFinite(rightMagnitude) || leftMagnitude < 1e-6 || rightMagnitude < 1e-6) return null;
  const dot = axes.reduce((sum, axis) => sum + (left[axis] * right[axis]), 0);
  const cosine = Math.max(-1, Math.min(1, dot / (leftMagnitude * rightMagnitude)));
  return Math.acos(cosine) * (180 / Math.PI);
}

function wrapRadians(value) {
  if (!Number.isFinite(value)) return null;
  let wrapped = value;
  while (wrapped > Math.PI) wrapped -= 2 * Math.PI;
  while (wrapped < -Math.PI) wrapped += 2 * Math.PI;
  return wrapped;
}

function forwardVector(rotation) {
  // subtr-actor exposes Rocket League's Euler rotation as pitch (x), roll (y), yaw (z), in radians.
  const pitch = wrapRadians(rotation?.x);
  const yaw = wrapRadians(rotation?.z);
  if (![pitch, yaw].every(Number.isFinite)) return null;
  return {
    x: Math.cos(pitch) * Math.cos(yaw),
    y: Math.cos(pitch) * Math.sin(yaw),
    z: Math.sin(pitch),
  };
}

function uprightDeviationDegrees(rotation) {
  const pitch = wrapRadians(rotation?.x);
  const roll = wrapRadians(rotation?.y);
  if (![pitch, roll].every(Number.isFinite)) return null;
  return Math.sqrt((pitch * pitch) + (roll * roll)) * (180 / Math.PI);
}

function mean(values) {
  const finiteValues = values.filter(Number.isFinite);
  return finiteValues.length ? finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length : null;
}

function percentile(values, fraction) {
  const finiteValues = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!finiteValues.length) return null;
  return finiteValues[Math.round((finiteValues.length - 1) * fraction)];
}

function playerInFrame(frame, subjectId) {
  return frame?.players?.find((player) => String(player.id ?? "").toLowerCase() === subjectId) ?? null;
}

function surfaceState(player) {
  const position = player?.position;
  if (![position?.x, position?.y, position?.z].every(Number.isFinite)) return "unknown";
  if (position.z <= GROUND_Z_MAX) return "ground";
  if (Math.abs(position.x) >= SIDE_WALL_X_MIN || Math.abs(position.y) >= BACK_WALL_Y_MIN) return "wall";
  if (position.z >= AERIAL_Z_MIN) return "aerial";
  return "transition";
}

function frameMeasurement(frame, subjectId) {
  const player = playerInFrame(frame, subjectId);
  if (!player) return null;
  const forward = forwardVector(player.rotation);
  const toBall = subtract(frame.ball?.position, player.position);
  const planarSpeed = magnitude(player.linearVelocity, ["x", "y"]);
  return {
    frame,
    player,
    state: surfaceState(player),
    speed: magnitude(player.linearVelocity),
    planarSpeed,
    angularSpeed: magnitude(player.angularVelocity),
    forward,
    forwardToVelocityDegrees: Number.isFinite(planarSpeed) && planarSpeed >= 300
      ? angleDegrees(forward, player.linearVelocity, ["x", "y"])
      : null,
    forwardToBallDegrees: angleDegrees(forward, toBall, ["x", "y"]),
    uprightDeviationDegrees: uprightDeviationDegrees(player.rotation),
  };
}

function contiguousSlice(measurements, timestamp, beforeSeconds, afterSeconds) {
  const selected = measurements.filter((item) => item.frame.timeSeconds >= timestamp - beforeSeconds
    && item.frame.timeSeconds <= timestamp + afterSeconds);
  if (!selected.length) return [];
  const anchorIndex = selected.reduce((best, item, index) => (
    Math.abs(item.frame.timeSeconds - timestamp) < Math.abs(selected[best].frame.timeSeconds - timestamp) ? index : best
  ), 0);
  let start = anchorIndex;
  let end = anchorIndex;
  while (start > 0 && selected[start].frame.timeSeconds - selected[start - 1].frame.timeSeconds <= MAX_CONTIGUOUS_GAP_SECONDS) start -= 1;
  while (end < selected.length - 1 && selected[end + 1].frame.timeSeconds - selected[end].frame.timeSeconds <= MAX_CONTIGUOUS_GAP_SECONDS) end += 1;
  return selected.slice(start, end + 1);
}

function primarySubjectEvent(event, subjectId) {
  return String(event?.playerId ?? "").toLowerCase() === subjectId;
}

function touchEpisodes(measurements, episodeTimeline, adaptiveSampling, subjectId) {
  const windowsByEvent = new Map((adaptiveSampling?.windows ?? []).map((window) => [window.eventId, window]));
  return (episodeTimeline?.events ?? [])
    .filter((event) => event.type === "touch" && primarySubjectEvent(event, subjectId) && Number.isFinite(event.startTimeSeconds))
    .map((event) => {
      const timestamp = event.startTimeSeconds;
      const sourceWindow = windowsByEvent.get(event.id);
      const window = contiguousSlice(measurements, timestamp, 0.75, 1.25);
      const contact = window.reduce((best, item) => (
        !best || Math.abs(item.frame.timeSeconds - timestamp) < Math.abs(best.frame.timeSeconds - timestamp) ? item : best
      ), null);
      const before = window.filter((item) => item.frame.timeSeconds < timestamp && item.frame.timeSeconds >= timestamp - 0.3);
      const after = window.filter((item) => item.frame.timeSeconds >= timestamp && item.frame.timeSeconds <= timestamp + 0.75);
      const pre = before.at(-1) ?? contact;
      const post = after.find((item) => item.frame.timeSeconds >= timestamp + 0.2) ?? after.at(-1) ?? contact;
      const playerBallRelativeVelocity = contact
        ? subtract(contact.player.linearVelocity, contact.frame.ball?.linearVelocity)
        : null;
      const preBallSpeed = magnitude(pre?.frame.ball?.linearVelocity);
      const postBallSpeed = magnitude(post?.frame.ball?.linearVelocity);
      const controlDistances = after.map((item) => item.player.distanceToBall).filter(Number.isFinite);
      const closeControlFrames = controlDistances.filter((distance) => distance <= 450).length;
      const valid = Boolean(contact && sourceWindow && window.length >= 8);
      return {
        id: `mechanics:touch:${event.id}`,
        sourceEventId: event.id,
        sourceEventType: event.type,
        timestampSeconds: timestamp,
        frame: event.startFrame ?? contact?.frame.index ?? null,
        eligible: valid,
        abstainReasons: valid ? [] : [!sourceWindow ? "detail_window_unavailable" : "insufficient_contiguous_detail_frames"],
        contactSurface: contact?.state ?? "unknown",
        observedAction: event.facts?.tags?.find((tag) => tag.group === "action")?.value ?? "unclassified",
        reception: event.facts?.tags?.find((tag) => tag.group === "reception")?.value ?? null,
        metrics: {
          approachSpeed: pre?.speed ?? null,
          relativeCarBallSpeed: magnitude(playerBallRelativeVelocity),
          approachToBallDegrees: pre?.forwardToBallDegrees ?? null,
          approachAngularSpeed: mean(before.map((item) => item.angularSpeed)),
          ballSpeedBefore: preBallSpeed,
          ballSpeedAfter: postBallSpeed,
          ballSpeedDelta: Number.isFinite(preBallSpeed) && Number.isFinite(postBallSpeed) ? postBallSpeed - preBallSpeed : null,
          ballDirectionChangeDegrees: angleDegrees(pre?.frame.ball?.linearVelocity, post?.frame.ball?.linearVelocity),
          postTouchCloseControlFraction: controlDistances.length ? closeControlFrames / controlDistances.length : null,
          postTouchMedianDistanceToBall: percentile(controlDistances, 0.5),
          postTouchP90DistanceToBall: percentile(controlDistances, 0.9),
          observationSeconds: window.length ? window.at(-1).frame.timeSeconds - window[0].frame.timeSeconds : 0,
          sampledFrames: window.length,
          detailRateHz: sourceWindow?.sampleRateHz ?? null,
        },
      };
    });
}

function recoveryEpisodes(measurements) {
  const episodes = [];
  let lastLanding = -Infinity;
  for (let index = 1; index < measurements.length; index += 1) {
    const previous = measurements[index - 1];
    const current = measurements[index];
    if (current.frame.timeSeconds - previous.frame.timeSeconds > MAX_CONTIGUOUS_GAP_SECONDS) continue;
    if (current.state !== "ground" || previous.state === "ground" || current.frame.timeSeconds - lastLanding < 0.45) continue;
    const timestamp = current.frame.timeSeconds;
    const window = contiguousSlice(measurements, timestamp, 1.5, 1.5);
    const before = window.filter((item) => item.frame.timeSeconds < timestamp);
    const after = window.filter((item) => item.frame.timeSeconds >= timestamp);
    if (!before.length || !after.length) continue;
    lastLanding = timestamp;
    const wallSamples = before.filter((item) => item.state === "wall" && timestamp - item.frame.timeSeconds <= 1.5);
    const aerialSamples = before.filter((item) => item.state === "aerial" && timestamp - item.frame.timeSeconds <= 1.5);
    const sourceSurface = wallSamples.length ? "wall" : aerialSamples.length ? "aerial" : "transition";
    const usefulSpeed = after.find((item) => Number.isFinite(item.speed) && item.speed >= 1_000);
    const stableHeading = after.find((item) => Number.isFinite(item.forwardToVelocityDegrees)
      && item.forwardToVelocityDegrees <= 30 && Number.isFinite(item.planarSpeed) && item.planarSpeed >= 600);
    const previousAir = before.at(-1);
    const valid = after.length >= 12 && Number.isFinite(current.uprightDeviationDegrees);
    episodes.push({
      id: `mechanics:recovery:${current.frame.index}`,
      timestampSeconds: timestamp,
      frame: current.frame.index,
      sourceSurface,
      eligible: valid,
      abstainReasons: valid ? [] : [after.length < 12 ? "insufficient_post_landing_detail" : "landing_rotation_unavailable"],
      metrics: {
        touchdownSpeed: current.speed,
        touchdownPlanarSpeed: current.planarSpeed,
        verticalImpactSpeed: Number.isFinite(previousAir?.player.linearVelocity?.z) ? Math.abs(previousAir.player.linearVelocity.z) : null,
        uprightDeviationDegrees: current.uprightDeviationDegrees,
        forwardToVelocityDegrees: current.forwardToVelocityDegrees,
        forwardToBallDegrees: current.forwardToBallDegrees,
        timeToUsefulSpeed: usefulSpeed ? usefulSpeed.frame.timeSeconds - timestamp : null,
        timeToStableHeading: stableHeading ? stableHeading.frame.timeSeconds - timestamp : null,
        postLandingPeakSpeed: percentile(after.map((item) => item.speed), 1),
        postLandingMeanAngularSpeed: mean(after.slice(0, 15).map((item) => item.angularSpeed)),
        wallToGroundSeconds: wallSamples.length ? timestamp - wallSamples.at(-1).frame.timeSeconds : null,
        maximumPreLandingHeight: percentile(before.map((item) => item.player.position?.z), 1),
        observationSeconds: after.at(-1).frame.timeSeconds - timestamp,
        sampledFrames: window.length,
      },
    });
  }
  return episodes;
}

function executionCounts(episodeTimeline) {
  const mechanicsTypes = new Set(["dodge", "dodge_reset", "flick", "half_flip", "speed_flip", "wall_aerial", "wavedash"]);
  return (episodeTimeline?.events ?? []).reduce((counts, event) => {
    if (!mechanicsTypes.has(event.type) || event.subjectInvolved !== true) return counts;
    counts[event.type] = (counts[event.type] ?? 0) + 1;
    return counts;
  }, {});
}

export function buildMechanicsModel({ normalized, frameState, episodeTimeline, adaptiveSampling }) {
  const subjectId = String(normalized?.subjectPlayerId ?? "").toLowerCase();
  const macro = (frameState?.frames ?? []).map((frame) => frameMeasurement(frame, subjectId)).filter(Boolean);
  const detail = (adaptiveSampling?.detailFrames ?? []).map((frame) => frameMeasurement(frame, subjectId)).filter(Boolean)
    .sort((left, right) => left.frame.timeSeconds - right.frame.timeSeconds || left.frame.index - right.frame.index);
  const touches = touchEpisodes(detail, episodeTimeline, adaptiveSampling, subjectId);
  const recoveries = recoveryEpisodes(detail);
  const stateCounts = macro.reduce((counts, item) => {
    counts[item.state] = (counts[item.state] ?? 0) + 1;
    return counts;
  }, {});
  const measuredStates = Object.values(stateCounts).reduce((sum, count) => sum + count, 0);
  const rotationCoverage = macro.length
    ? macro.filter((item) => Number.isFinite(item.uprightDeviationDegrees)).length / macro.length
    : 0;
  return {
    schemaVersion: MECHANICS_MODEL_VERSION,
    publicationStatus: "private_shadow",
    subjectPlayerId: subjectId || null,
    measurementBasis: {
      telemetry: ["position", "rotation", "linear_velocity", "angular_velocity", "boost", "ball_distance", "parser_events"],
      detailRateHz: adaptiveSampling?.detailSampleRateHz ?? null,
      causalBoundary: "The model measures replay-visible kinematics. It does not infer controller inputs, intent, comms, fatigue or motor impairment.",
    },
    touches,
    recoveries,
    summary: {
      macroFrameCount: macro.length,
      detailFrameCount: detail.length,
      rotationCoverage,
      touchEpisodes: touches.length,
      eligibleTouchEpisodes: touches.filter((episode) => episode.eligible).length,
      recoveryEpisodes: recoveries.length,
      eligibleRecoveryEpisodes: recoveries.filter((episode) => episode.eligible).length,
      surfaceFractions: Object.fromEntries(["ground", "wall", "aerial", "transition", "unknown"].map((state) => [
        state,
        measuredStates ? (stateCounts[state] ?? 0) / measuredStates : 0,
      ])),
      executionEventCounts: executionCounts(episodeTimeline),
    },
  };
}

export function mechanicsModelSummary(model) {
  return {
    schemaVersion: model?.schemaVersion ?? MECHANICS_MODEL_VERSION,
    publicationStatus: model?.publicationStatus ?? "private_shadow",
    measurementBasis: model?.measurementBasis ?? null,
    ...(model?.summary ?? {
      macroFrameCount: 0,
      detailFrameCount: 0,
      rotationCoverage: 0,
      touchEpisodes: 0,
      eligibleTouchEpisodes: 0,
      recoveryEpisodes: 0,
      eligibleRecoveryEpisodes: 0,
      surfaceFractions: {},
      executionEventCounts: {},
    }),
  };
}
