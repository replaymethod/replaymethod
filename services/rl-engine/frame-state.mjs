const VECTOR_AXES = Object.freeze(["x", "y", "z"]);

function finite(value) {
  return Number.isFinite(value) ? value : null;
}

function vector(row, offset) {
  return Object.fromEntries(VECTOR_AXES.map((axis, index) => [axis, finite(row[offset + index])]));
}

function identityValue(identity) {
  if (!identity || typeof identity !== "object") return "";
  const entry = Object.entries(identity).find(([, value]) => String(value ?? "").trim());
  return entry ? `${entry[0].toLowerCase()}:${String(entry[1]).trim()}` : "";
}

function replayPlayers(meta = {}) {
  const entries = [
    ...((Array.isArray(meta.team_zero) ? meta.team_zero : []).map((player) => ({ player, team: 0 }))),
    ...((Array.isArray(meta.team_one) ? meta.team_one : []).map((player) => ({ player, team: 1 }))),
  ];
  return entries.map(({ player, team }, index) => ({
    index,
    id: identityValue(player?.remote_id) || String(player?.remote_id ?? player?.name ?? `player-${index + 1}`),
    name: String(player?.name ?? `Player ${index + 1}`),
    team,
  }));
}

function readRigidBody(row, offset) {
  return {
    position: vector(row, offset),
    rotation: vector(row, offset + 3),
    linearVelocity: vector(row, offset + 6),
    angularVelocity: vector(row, offset + 9),
  };
}

function frameCoverage(frames, playerCount) {
  if (!frames.length) return { ball: 0, players: 0 };
  let ball = 0;
  let players = 0;
  for (const frame of frames) {
    if (frame.ball.position.x !== null) ball += 1;
    players += frame.players.filter((player) => player.position.x !== null).length;
  }
  return {
    ball: ball / frames.length,
    players: playerCount ? players / (frames.length * playerCount) : 0,
  };
}

/**
 * Convert subtr-actor's sampled matrix into a stable, named frame schema.
 * This layer contains observations only; it makes no coaching judgement.
 */
export function normalizeFrameState(ndarray, replayMeta = {}, sampleRateHz = 10) {
  const rows = Array.isArray(ndarray?.array_data) ? ndarray.array_data : [];
  const globalHeaders = ndarray?.metadata?.column_headers?.global_headers ?? [];
  const playerHeaders = ndarray?.metadata?.column_headers?.player_headers ?? [];
  const players = replayPlayers(replayMeta);
  const globalWidth = globalHeaders.length;
  const playerWidth = playerHeaders.length;
  const expectedWidth = globalWidth + (players.length * playerWidth);

  if (!globalWidth || !playerWidth || !players.length) {
    throw new Error("Frame-state input is missing column or player metadata.");
  }
  if (rows.some((row) => !Array.isArray(row) || row.length !== expectedWidth)) {
    throw new Error(`Frame-state matrix width did not match metadata (expected ${expectedWidth}).`);
  }

  const frames = rows.map((row, index) => ({
    index,
    timeSeconds: finite(row[0]),
    secondsRemaining: finite(row[1]),
    ball: readRigidBody(row, 2),
    players: players.map((player) => {
      const offset = globalWidth + (player.index * playerWidth);
      return {
        ...player,
        boost: finite(row[offset]),
        distanceToBall: finite(row[offset + 1]),
        ...readRigidBody(row, offset + 2),
      };
    }),
  }));
  const firstTime = frames[0]?.timeSeconds;
  const lastTime = frames.at(-1)?.timeSeconds;

  return {
    schemaVersion: "rocket-league-frame-state.v1",
    sampleRateHz,
    players,
    frames,
    summary: {
      frameCount: frames.length,
      playerCount: players.length,
      durationSeconds: firstTime !== null && lastTime !== null && frames.length
        ? Math.max(0, lastTime - firstTime)
        : 0,
      coverage: frameCoverage(frames, players.length),
    },
  };
}

export function frameStateSummary(frameState) {
  return {
    schemaVersion: frameState.schemaVersion,
    sampleRateHz: frameState.sampleRateHz,
    ...frameState.summary,
  };
}
