import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  get_ndarray_with_info,
  get_replay_info,
  get_replay_meta,
  get_stats_timeline,
  initSync,
  validate_replay,
} from "@rlrml/subtr-actor";
import { episodeTimelineSummary, normalizeEpisodeTimeline } from "./episode-timeline.mjs";
import { frameStateSummary, normalizeFrameState } from "./frame-state.mjs";

export const PARSER_VERSION = "subtr-actor@1.2.0";
export const NORMALIZER_VERSION = "rocket-league-normalizer@0.2.0";

let initialized = false;

export class ReplayInputError extends Error {
  constructor(code, publicMessage, internalMessage = publicMessage, candidatePlayers = []) {
    super(internalMessage);
    this.name = "ReplayInputError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.candidatePlayers = [...new Set(candidatePlayers.filter((name) => typeof name === "string" && name.trim()).map((name) => name.trim()))].slice(0, 8);
  }
}

export function initializeParser() {
  if (initialized) return;
  const wasmUrl = new URL(
    "rl_replay_subtr_actor_bg.wasm",
    import.meta.resolve("@rlrml/subtr-actor"),
  );
  initSync({ module: readFileSync(fileURLToPath(wasmUrl)) });
  initialized = true;
}

export function plain(value) {
  if (value instanceof Map) {
    return Object.fromEntries([...value.entries()].map(([key, item]) => [String(key), plain(item)]));
  }
  if (Array.isArray(value)) return value.map(plain);
  if (ArrayBuffer.isView(value)) return Array.from(value, plain);
  if (typeof value === "bigint") return value.toString();
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  }
  return value;
}

function validity(result) {
  const normalized = plain(result);
  const valid = normalized?.valid ?? normalized?.is_valid ?? normalized?.success;
  return {
    valid: valid === true,
    error: String(normalized?.error ?? normalized?.message ?? "The parser rejected this replay."),
  };
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function scalarText(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return "";
}

function replayMetaPayload(meta) {
  return meta?.replay_meta && typeof meta.replay_meta === "object"
    ? meta.replay_meta
    : (meta ?? {});
}

function remotePlayerId(player) {
  const remote = player?.remote_id ?? player?.online_id ?? player?.id;
  const direct = scalarText(remote);
  if (direct) return direct;
  if (remote && typeof remote === "object") {
    const entry = Object.entries(remote).find(([, value]) => scalarText(value));
    if (entry) return `${entry[0].toLowerCase()}:${scalarText(entry[1])}`;
  }
  return scalarText(player?.stats?.OnlineID);
}

function headerValue(meta, name) {
  const headers = Array.isArray(meta?.all_headers) ? meta.all_headers : [];
  const entry = headers.find((item) => Array.isArray(item) && item[0] === name);
  return entry?.[1];
}

function replayMode(meta) {
  const gameType = meta?.game_type;
  const direct = text(gameType);
  if (direct) return direct;

  const playlistId = Number(gameType?.playlist_id);
  const playlists = new Map([
    [10, "Ranked Duel"],
    [11, "Ranked Doubles"],
    [13, "Ranked Standard"],
  ]);
  return playlists.get(playlistId) ?? text(gameType?.game_type);
}

function playerNames(meta) {
  const teams = [
    ...(((Array.isArray(meta?.team_zero) && meta.team_zero) || []).map((player) => ({ player, team: 0 }))),
    ...(((Array.isArray(meta?.team_one) && meta.team_one) || []).map((player) => ({ player, team: 1 }))),
  ];
  return teams
    .map(({ player, team }) => ({
      name: text(player?.name ?? player?.player_name),
      id: remotePlayerId(player),
      team,
      raw: player,
    }))
    .filter((player) => player.name);
}

export function inspectReplayRoster(bytes) {
  initializeParser();
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const checked = validity(validate_replay(data));
  if (!checked.valid) {
    throw new ReplayInputError(
      "invalid_replay",
      "This file is not a supported Rocket League replay or it is corrupted.",
      checked.error,
    );
  }
  const info = plain(get_replay_info(data));
  const metaResult = plain(get_replay_meta(data, [], []));
  const normalized = normalizeReplayMetadata(metaResult, info);
  return {
    players: normalized.players.map(({ name, id, team }) => ({ name, id, team })),
    mode: normalized.mode || null,
    gameVersion: normalized.gameVersion || null,
    occurredAt: normalized.occurredAt || null,
  };
}

export function normalizeReplayMetadata(metaResult, info = {}) {
  const meta = replayMetaPayload(metaResult);
  return {
    meta,
    players: playerNames(meta),
    mode: replayMode(meta),
    gameVersion: text(info?.build_version ?? info?.game_version ?? info?.version)
      || scalarText(headerValue(meta, "BuildVersion"))
      || scalarText(headerValue(meta, "GameVersion")),
    occurredAt: text(info?.date ?? info?.recorded_at)
      || scalarText(headerValue(meta, "Date")),
  };
}

function identityCandidates(input) {
  const decoded = (() => {
    try { return decodeURIComponent(input); } catch { return input; }
  })().trim();
  return [...new Set([
    decoded,
    decoded.split("·")[0]?.trim(),
    decoded.split("|")[0]?.trim(),
    decoded.replace(/\s+(ranked|casual|competitive)\b.*$/i, "").trim(),
  ].filter(Boolean))];
}

function resolvePlayer(meta, requestedIdentity) {
  const players = playerNames(meta);
  const candidates = identityCandidates(requestedIdentity);
  const exact = players.filter((player) => candidates.some((candidate) =>
    player.name.localeCompare(candidate, undefined, { sensitivity: "accent" }) === 0 ||
    (player.id && player.id.localeCompare(candidate, undefined, { sensitivity: "accent" }) === 0)
  ));
  if (exact.length === 1) return { player: exact[0], players };
  if (!players.length) {
    throw new ReplayInputError(
      "replay_players_missing",
      "The replay was parsed, but no player identities were available.",
    );
  }
  if (!exact.length) {
    throw new ReplayInputError(
      "subject_player_not_found",
      `We parsed the replay but could not find “${candidates[0] || "the submitted player"}”. Use the exact in-game name shown in the match.`,
      `Requested ${JSON.stringify(candidates)}; replay players: ${players.map((player) => player.name).join(", ")}`,
      players.map((player) => player.name),
    );
  }
  throw new ReplayInputError(
    "subject_player_ambiguous",
    "More than one replay player matched that identity. Add the exact platform ID.",
    `Requested ${JSON.stringify(candidates)}; matching replay players: ${exact.map((player) => player.name).join(", ")}`,
    exact.map((player) => player.name),
  );
}

function safeReplayMetadata(info, meta, subject, playerCount, frameState, episodeTimeline) {
  return {
    replayInfo: info,
    gameType: meta?.game_type ?? null,
    season: meta?.season ?? null,
    subject: { name: subject.name, id: subject.id || null },
    playerCount,
    evidenceEngine: {
      frameState: frameStateSummary(frameState),
      episodeTimeline: episodeTimelineSummary(episodeTimeline),
    },
  };
}

export function buildReplayEvidence(bytes, requestedIdentity, rank = "") {
  initializeParser();
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const checked = validity(validate_replay(data));
  if (!checked.valid) {
    throw new ReplayInputError(
      "invalid_replay",
      "This file is not a supported Rocket League replay or it is corrupted.",
      checked.error,
    );
  }

  const info = plain(get_replay_info(data));
  const metaResult = plain(get_replay_meta(data, ["CurrentTime", "SecondsRemaining"], ["PlayerBoost", "PlayerBallDistance"]));
  const normalizedMeta = normalizeReplayMetadata(metaResult, info);
  const { player, players } = resolvePlayer(normalizedMeta.meta, requestedIdentity);
  const ndarray = plain(get_ndarray_with_info(
    data,
    ["CurrentTime", "SecondsRemaining", "BallRigidBody"],
    ["PlayerBoost", "PlayerBallDistance", "PlayerRigidBody"],
    10,
  ));
  const frameState = normalizeFrameState(ndarray, normalizedMeta.meta, 10);
  const statsTimeline = plain(get_stats_timeline(data));
  const episodeTimeline = normalizeEpisodeTimeline(statsTimeline, player.id || player.name);

  const normalized = {
    schemaVersion: "game-data.v1",
    game: "rocket-league",
    source: "rocket-league-replay",
    subjectPlayerId: player.id || player.name,
    subjectDisplayName: player.name,
    mode: normalizedMeta.mode || undefined,
    rank: text(rank) || undefined,
    gameVersion: normalizedMeta.gameVersion || undefined,
    occurredAt: normalizedMeta.occurredAt || undefined,
    metadata: safeReplayMetadata(
      info,
      normalizedMeta.meta,
      player,
      players.length,
      frameState,
      episodeTimeline,
    ),
    derivedMetrics: [],
    limitations: [
      "This parser checkpoint proves replay compatibility and player attribution; public coaching detectors remain disabled until precision calibration passes.",
    ],
  };

  return { normalized, frameState, episodeTimeline };
}

export function inspectReplay(bytes, requestedIdentity, rank = "") {
  return buildReplayEvidence(bytes, requestedIdentity, rank).normalized;
}
