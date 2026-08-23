#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { inspectReplay } from "../services/rl-engine/parser.mjs";

const API_ROOT = "https://ballchasing.com/api";
const SCHEMA_VERSION = "replay-method-season21-corpus.v2";
const SEASON_FILTER = "f21";
const SEASON_NUMBER = 21;
const REQUEST_INTERVAL_MS = 1_050;
const MINIMUM_REPLAY_BYTES = 1_024;
const MAX_PAGES_PER_CELL = 60;
const PLAYER_CAP = 4;
const UPLOADER_CAP = 4;
const PC_PLATFORMS = new Set(["steam", "epic"]);
const modes = [
  { mode: "2v2", playlist: "ranked-doubles", players: 4 },
  { mode: "3v3", playlist: "ranked-standard", players: 6 },
  { mode: "1v1", playlist: "ranked-duels", players: 2 },
];
const rankGroups = [
  { group: "Gold", filter: "gold", tiers: ["I", "II", "III"] },
  { group: "Platinum", filter: "platinum", tiers: ["I", "II", "III"] },
  { group: "Diamond", filter: "diamond", tiers: ["I", "II", "III"] },
  { group: "Champion", filter: "champion", tiers: ["I", "II", "III"] },
  { group: "Grand Champion", filter: "grand-champion", tiers: ["I", "II", "III"] },
];
const matrix = {
  Gold: { "2v2": 15, "3v3": 9, "1v1": 6 },
  Platinum: { "2v2": 22, "3v3": 14, "1v1": 9 },
  Diamond: { "2v2": 28, "3v3": 16, "1v1": 11 },
  Champion: { "2v2": 25, "3v3": 15, "1v1": 10 },
  "Grand Champion": { "2v2": 10, "3v3": 6, "1v1": 4 },
};

function argument(name, fallback = null, { multiple = false } = {}) {
  const values = process.argv.flatMap((value, index) => value === name ? [process.argv[index + 1]] : []).filter(Boolean);
  return multiple ? values : values.at(-1) ?? fallback;
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fingerprint(value, salt) {
  return value ? hash(`${salt}:${value}`).slice(0, 20) : null;
}

function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const partial = `${path}.partial`;
  writeFileSync(partial, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(partial, path);
}

function fineTargets() {
  const result = [];
  for (const mode of modes) for (const rankGroup of rankGroups) {
    const total = matrix[rankGroup.group][mode.mode];
    const base = Math.floor(total / 3);
    const remainder = total % 3;
    rankGroup.tiers.forEach((tier, index) => result.push({
      key: `${mode.mode}:${rankGroup.group} ${tier}`,
      mode: mode.mode,
      playlist: mode.playlist,
      playerCount: mode.players,
      rankGroup: rankGroup.group,
      rankTier: tier,
      rankLabel: `${rankGroup.group} ${tier}`,
      rankFilter: rankGroup.filter === "grand-champion" ? "grand-champion" : `${rankGroup.filter}-${index + 1}`,
      target: base + Number(index < remainder),
    }));
  }
  return result;
}

function createManifest(outputDirectory, priorManifestPaths) {
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: {
      provider: "ballchasing.com",
      api: "official",
      seasonFilter: SEASON_FILTER,
      seasonNumber: SEASON_NUMBER,
      purpose: "private_internal_calibration_and_release_evaluation",
      customerData: false,
    },
    policy: {
      exactApprovedCount: 200,
      rankProvenance: "Ballchasing player rank object from the Season 21 replay listing; no inferred rank",
      pcSubjectPlatforms: [...PC_PLATFORMS],
      uploaderCap: UPLOADER_CAP,
      playerCap: PLAYER_CAP,
      rawBinariesInGit: false,
      splitMethod: "Within each mode/rank-group stratum, SHA-256 order with globally balanced 60/20/20 quotas",
      blindHoldoutUseBeforeFreeze: "prohibited; only automated ingestion compatibility is recorded during acquisition",
      priorManifestPaths,
    },
    privacySalt: randomBytes(32).toString("hex"),
    outputDirectory,
    targets: fineTargets(),
    discovery: {},
    approved: [],
    exclusions: [],
    summary: null,
  };
}

function loadManifest(path, outputDirectory, priorManifestPaths) {
  if (!existsSync(path)) return createManifest(outputDirectory, priorManifestPaths);
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  if (manifest.schemaVersion !== SCHEMA_VERSION || !Array.isArray(manifest.approved) || !Array.isArray(manifest.exclusions)) {
    throw new Error(`Unsupported Season 21 acquisition manifest: ${path}`);
  }
  return manifest;
}

function priorIdentities(paths) {
  const result = { replayIds: new Set(), matchGuids: new Set(), hashes: new Set() };
  for (const path of paths) {
    if (!existsSync(path)) continue;
    const value = JSON.parse(readFileSync(path, "utf8"));
    const rows = Array.isArray(value.approved) ? value.approved : Array.isArray(value.replays) ? value.replays : [];
    for (const row of rows) {
      if (row.ballchasingReplayId) result.replayIds.add(String(row.ballchasingReplayId).toLowerCase());
      if (row.replayId) result.replayIds.add(String(row.replayId).toLowerCase());
      if (row.matchGuid) result.matchGuids.add(String(row.matchGuid).toLowerCase());
      if (row.sha256) result.hashes.add(String(row.sha256).toLowerCase());
    }
  }
  return result;
}

function allPlayers(replay) {
  return [...(replay.blue?.players ?? []), ...(replay.orange?.players ?? [])];
}

function playerIdentity(player) {
  const platform = String(player?.id?.platform ?? "").toLowerCase();
  const id = String(player?.id?.id ?? "").trim();
  return platform && id ? `${platform}:${id}` : "";
}

function exactRankSubject(replay, cell) {
  const expected = `${cell.rankLabel} Division `;
  return allPlayers(replay).find((player) =>
    PC_PLATFORMS.has(String(player?.id?.platform ?? "").toLowerCase())
    && String(player?.rank?.name ?? "").startsWith(expected)
    && playerIdentity(player)
  ) ?? null;
}

function replayUrl(cell) {
  const url = new URL(`${API_ROOT}/replays`);
  url.searchParams.set("playlist", cell.playlist);
  url.searchParams.set("season", SEASON_FILTER);
  url.searchParams.set("min-rank", cell.rankFilter);
  if (cell.rankGroup !== "Grand Champion") url.searchParams.set("max-rank", cell.rankFilter);
  url.searchParams.set("sort-by", "replay-date");
  url.searchParams.set("sort-dir", "desc");
  url.searchParams.set("count", "200");
  return url.toString();
}

let lastRequestAt = 0;
async function apiRequest(token, url, { binary = false } = {}) {
  const wait = Math.max(0, REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt));
  if (wait) await new Promise((resolvePromise) => setTimeout(resolvePromise, wait));
  lastRequestAt = Date.now();
  const response = await fetch(url, { headers: { Authorization: token }, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Ballchasing HTTP ${response.status} for ${new URL(url).pathname}`);
  return binary ? new Uint8Array(await response.arrayBuffer()) : response.json();
}

function coarseKey(row) {
  return `${row.mode}:${row.rankGroup}`;
}

function splitQuotas() {
  const cells = modes.flatMap((mode) => rankGroups.map((rank) => ({
    key: `${mode.mode}:${rank.group}`,
    total: matrix[rank.group][mode.mode],
  })));
  for (const cell of cells) {
    cell.challenge = Math.floor(cell.total * 0.2);
    cell.holdout = Math.floor(cell.total * 0.2);
  }
  for (const split of ["challenge", "holdout"]) {
    let missing = 40 - cells.reduce((sum, cell) => sum + cell[split], 0);
    for (const cell of [...cells].sort((left, right) =>
      ((right.total * 0.2) % 1) - ((left.total * 0.2) % 1) || left.key.localeCompare(right.key))) {
      if (!missing) break;
      cell[split] += 1;
      missing -= 1;
    }
  }
  return Object.fromEntries(cells.map((cell) => [cell.key, {
    calibration_dev: cell.total - cell.challenge - cell.holdout,
    challenge: cell.challenge,
    frozen_blind_holdout: cell.holdout,
  }]));
}

function assignSplits(rows) {
  const quotas = splitQuotas();
  for (const [key, quota] of Object.entries(quotas)) {
    const cohort = rows.filter((row) => coarseKey(row) === key)
      .sort((left, right) => hash(`season21-split-v1:${left.ballchasingReplayId}`).localeCompare(hash(`season21-split-v1:${right.ballchasingReplayId}`)));
    let index = 0;
    for (const split of ["calibration_dev", "challenge", "frozen_blind_holdout"]) {
      cohort.slice(index, index + quota[split]).forEach((row) => { row.split = split; });
      index += quota[split];
    }
  }
}

const outputDirectory = resolve(argument("--output", "private-corpus/season21-2026-08-23"));
const manifestPath = resolve(argument("--manifest", `${outputDirectory}/private-manifest.json`));
const priorManifestPaths = argument("--prior-manifest", null, { multiple: true }).map((path) => resolve(path));
const token = process.env.BALLCHASING_API_TOKEN?.trim();
if (!token) throw new Error("BALLCHASING_API_TOKEN must be supplied as a secret environment variable.");
mkdirSync(resolve(outputDirectory, "approved"), { recursive: true, mode: 0o700 });
mkdirSync(resolve(outputDirectory, "excluded"), { recursive: true, mode: 0o700 });
const manifest = loadManifest(manifestPath, outputDirectory, priorManifestPaths);
const persist = () => { manifest.updatedAt = new Date().toISOString(); atomicJson(manifestPath, manifest); };
const prior = priorIdentities(priorManifestPaths);
const replayIds = new Set([...prior.replayIds, ...manifest.approved.map((row) => row.ballchasingReplayId.toLowerCase())]);
const matchGuids = new Set([...prior.matchGuids, ...manifest.approved.map((row) => row.matchGuid.toLowerCase())]);
const checksums = new Set([...prior.hashes, ...manifest.approved.map((row) => row.sha256.toLowerCase())]);
const uploaderCounts = new Map();
const playerCounts = new Map();
for (const row of manifest.approved) {
  if (row.uploaderFingerprint) uploaderCounts.set(row.uploaderFingerprint, (uploaderCounts.get(row.uploaderFingerprint) ?? 0) + 1);
  for (const player of row.playerFingerprints ?? []) playerCounts.set(player, (playerCounts.get(player) ?? 0) + 1);
}

await apiRequest(token, `${API_ROOT}/`);
console.error("Season 21 source authenticated. Acquisition is resumable and secrets are not persisted.");

for (const cell of manifest.targets) {
  const accepted = () => manifest.approved.filter((row) => row.cellKey === cell.key).length;
  if (accepted() >= cell.target) continue;
  let next = manifest.discovery[cell.key]?.next ?? replayUrl(cell);
  let pagesThisRun = 0;
  while (accepted() < cell.target && next && pagesThisRun < MAX_PAGES_PER_CELL) {
    const page = await apiRequest(token, next);
    pagesThisRun += 1;
    manifest.discovery[cell.key] = { pages: (manifest.discovery[cell.key]?.pages ?? 0) + 1, next: page.next ?? null, lastQueriedAt: new Date().toISOString() };
    persist();
    for (const replay of page.list ?? []) {
      if (accepted() >= cell.target) break;
      if (!replay?.id || replayIds.has(String(replay.id).toLowerCase())) continue;
      const subject = exactRankSubject(replay, cell);
      if (!subject) continue;
      const candidatePlayers = allPlayers(replay);
      const uploaderFingerprint = fingerprint(replay.uploader?.steam_id, manifest.privacySalt);
      const playerFingerprints = [...new Set(candidatePlayers.map((player) => fingerprint(playerIdentity(player), manifest.privacySalt)).filter(Boolean))].sort();
      const reject = (reason, details = null) => {
        manifest.exclusions.push({ ballchasingReplayId: replay.id, cellKey: cell.key, stage: "candidate", reason, details, excludedAt: new Date().toISOString() });
        replayIds.add(String(replay.id).toLowerCase());
        persist();
      };
      if (Number(replay.season) !== SEASON_NUMBER || replay.season_type !== "free2play") { reject("wrong_season"); continue; }
      if (replay.playlist_id !== cell.playlist || candidatePlayers.length !== cell.playerCount) { reject("wrong_mode_or_player_count"); continue; }
      if (uploaderFingerprint && (uploaderCounts.get(uploaderFingerprint) ?? 0) >= UPLOADER_CAP) { reject("uploader_cap"); continue; }
      if (playerFingerprints.some((player) => (playerCounts.get(player) ?? 0) >= PLAYER_CAP)) { reject("player_cap"); continue; }
      let bytes;
      try {
        bytes = await apiRequest(token, `${API_ROOT}/replays/${encodeURIComponent(replay.id)}/file`, { binary: true });
      } catch (error) { reject("download_failed", error.message); continue; }
      if (bytes.byteLength < MINIMUM_REPLAY_BYTES) { reject("file_too_small", bytes.byteLength); continue; }
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      if (checksums.has(sha256)) { reject("duplicate_sha256", sha256); continue; }
      let normalized;
      try {
        normalized = inspectReplay(bytes, playerIdentity(subject), cell.rankLabel);
      } catch (error) { reject("parser_rejected", { code: error?.code ?? "parser_error", message: String(error?.message ?? error).slice(0, 240) }); continue; }
      const matchGuid = String(normalized.metadata?.matchGuid ?? "").trim();
      if (!matchGuid) { reject("match_guid_missing"); continue; }
      if (matchGuids.has(matchGuid.toLowerCase())) { reject("duplicate_match_guid", matchGuid); continue; }
      const expectedMode = { "1v1": "Ranked Duel", "2v2": "Ranked Doubles", "3v3": "Ranked Standard" }[cell.mode];
      if (normalized.mode !== expectedMode) { reject("parser_mode_mismatch", normalized.mode ?? null); continue; }
      const destination = resolve(outputDirectory, "approved", `${replay.id}.replay`);
      const partial = `${destination}.partial`;
      writeFileSync(partial, bytes, { mode: 0o600 });
      renameSync(partial, destination);
      const row = {
        cellKey: cell.key,
        ballchasingReplayId: replay.id,
        replayId: replay.rocket_league_id ?? null,
        matchGuid,
        sha256,
        rank: cell.rankLabel,
        rankGroup: cell.rankGroup,
        rankProvenance: { source: "ballchasing_player_rank", name: subject.rank.name, tier: subject.rank.tier, division: subject.rank.division, subjectPlatform: subject.id.platform },
        mode: cell.mode,
        playlist: replay.playlist_id,
        playerCount: candidatePlayers.length,
        replayDate: replay.date,
        season: replay.season,
        seasonType: replay.season_type,
        gameBuild: normalized.gameVersion ?? null,
        parserResult: { status: "passed", parser: "subtr-actor@1.2.0", normalizer: "rocket-league-normalizer@0.3.0", performanceMetrics: normalized.metadata?.performanceSnapshot?.metrics?.length ?? 0 },
        uploaderFingerprint,
        playerFingerprints,
        subjectFingerprint: fingerprint(playerIdentity(subject), manifest.privacySalt),
        sizeBytes: bytes.byteLength,
        storagePath: destination,
        split: "pending",
        approvedAt: new Date().toISOString(),
      };
      manifest.approved.push(row);
      replayIds.add(String(replay.id).toLowerCase());
      matchGuids.add(matchGuid.toLowerCase());
      checksums.add(sha256);
      if (uploaderFingerprint) uploaderCounts.set(uploaderFingerprint, (uploaderCounts.get(uploaderFingerprint) ?? 0) + 1);
      for (const player of playerFingerprints) playerCounts.set(player, (playerCounts.get(player) ?? 0) + 1);
      persist();
      console.error(`Approved ${manifest.approved.length}/200 · ${cell.key} ${accepted()}/${cell.target}`);
    }
    next = page.next ?? null;
  }
  if (accepted() < cell.target) console.error(`INCOMPLETE ${cell.key}: ${accepted()}/${cell.target}`);
}

if (manifest.approved.length === 200 && manifest.targets.every((cell) => manifest.approved.filter((row) => row.cellKey === cell.key).length === cell.target)) {
  assignSplits(manifest.approved);
}
const counts = Object.fromEntries(["calibration_dev", "challenge", "frozen_blind_holdout", "pending"].map((split) => [split, manifest.approved.filter((row) => row.split === split).length]));
manifest.summary = {
  approved: manifest.approved.length,
  excluded: manifest.exclusions.length,
  splitCounts: counts,
  modeCounts: Object.fromEntries(modes.map(({ mode }) => [mode, manifest.approved.filter((row) => row.mode === mode).length])),
  rankGroupCounts: Object.fromEntries(rankGroups.map(({ group }) => [group, manifest.approved.filter((row) => row.rankGroup === group).length])),
  uniqueReplayIds: new Set(manifest.approved.map((row) => row.ballchasingReplayId)).size,
  uniqueMatchGuids: new Set(manifest.approved.map((row) => row.matchGuid)).size,
  uniqueHashes: new Set(manifest.approved.map((row) => row.sha256)).size,
  completedAt: manifest.approved.length === 200 ? new Date().toISOString() : null,
};
persist();
console.error(JSON.stringify(manifest.summary));
if (manifest.approved.length !== 200 || counts.calibration_dev !== 120 || counts.challenge !== 40 || counts.frozen_blind_holdout !== 40) process.exitCode = 2;
