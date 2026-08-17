import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  get_ndarray_with_info,
  get_replay_info,
  get_replay_meta,
  initSync,
  validate_replay,
} from "@rlrml/subtr-actor";

export const PARSER_VERSION = "subtr-actor@1.2.0";
export const NORMALIZER_VERSION = "rocket-league-normalizer@0.1.0";

let initialized = false;

export class ReplayInputError extends Error {
  constructor(code, publicMessage, internalMessage = publicMessage) {
    super(internalMessage);
    this.name = "ReplayInputError";
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

function initializeParser() {
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

function playerNames(meta) {
  const teams = [
    ...((Array.isArray(meta?.team_zero) && meta.team_zero) || []),
    ...((Array.isArray(meta?.team_one) && meta.team_one) || []),
  ];
  return teams
    .map((player) => ({
      name: text(player?.name ?? player?.player_name),
      id: text(player?.remote_id ?? player?.online_id ?? player?.id),
      raw: player,
    }))
    .filter((player) => player.name);
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
    );
  }
  throw new ReplayInputError(
    "subject_player_ambiguous",
    "More than one replay player matched that identity. Add the exact platform ID.",
  );
}

function safeReplayMetadata(info, meta, subject, playerCount, sampledFrames) {
  return {
    replayInfo: info,
    gameType: meta?.game_type ?? null,
    season: meta?.season ?? null,
    subject: { name: subject.name, id: subject.id || null },
    playerCount,
    sampledFrames,
  };
}

export function inspectReplay(bytes, requestedIdentity, rank = "") {
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
  const meta = plain(get_replay_meta(data, ["CurrentTime", "SecondsRemaining"], ["PlayerBoost", "PlayerBallDistance"]));
  const { player, players } = resolvePlayer(meta, requestedIdentity);
  const ndarray = plain(get_ndarray_with_info(
    data,
    ["CurrentTime", "SecondsRemaining", "BallRigidBody"],
    ["PlayerBoost", "PlayerBallDistance", "PlayerRigidBody"],
    10,
  ));

  return {
    schemaVersion: "game-data.v1",
    game: "rocket-league",
    source: "rocket-league-replay",
    subjectPlayerId: player.id || player.name,
    subjectDisplayName: player.name,
    mode: text(meta?.game_type) || undefined,
    rank: text(rank) || undefined,
    gameVersion: text(info?.build_version ?? info?.game_version ?? info?.version) || undefined,
    occurredAt: text(info?.date ?? info?.recorded_at) || undefined,
    metadata: safeReplayMetadata(
      info,
      meta,
      player,
      players.length,
      Array.isArray(ndarray?.array_data) ? ndarray.array_data.length : 0,
    ),
    derivedMetrics: [],
    limitations: [
      "This parser checkpoint proves replay compatibility and player attribution; public coaching detectors remain disabled until precision calibration passes.",
    ],
  };
}
