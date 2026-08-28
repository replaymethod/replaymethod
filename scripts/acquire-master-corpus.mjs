#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { inspectReplay, PARSER_VERSION } from "../services/rl-engine/parser.mjs";
import {
  assignMasterCorpusSplits,
  buildMasterCorpusCells,
  masterCorpusPlanSummary,
  MASTER_CORPUS_PLAN_VERSION,
} from "../services/rl-engine/master-corpus-plan.mjs";
import {
  MASTER_CORPUS_MANIFEST_VERSION,
  MASTER_CORPUS_RESUME_PROTOCOL,
  masterCorpusSubjectParserIdentities,
  migrateMasterCorpusProgress,
  recordMasterCorpusExclusion,
} from "../services/rl-engine/master-corpus-progress.mjs";

const API_ROOT = "https://ballchasing.com/api";
const SCHEMA_VERSION = MASTER_CORPUS_MANIFEST_VERSION;
const REQUEST_INTERVAL_MS = 1_050;
const MAX_RETRIES = 6;
const MAX_RATE_LIMIT_WAITS = 90;
const MAX_PAGES_PER_CELL = 100;
const MINIMUM_REPLAY_BYTES = 1_024;
const PLAYER_CAP = 1;
const UPLOADER_CAP = 4;

function argumentsFor(name) {
  return process.argv.flatMap((value, index) => value === name ? [process.argv[index + 1]] : []).filter(Boolean);
}

function argument(name, fallback = null) {
  return argumentsFor(name).at(-1) ?? fallback;
}

function timestamp() {
  return new Date().toISOString();
}

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
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

function playerIdentity(player) {
  const platform = String(player?.id?.platform ?? "").trim().toLowerCase();
  const id = String(player?.id?.id ?? "").trim();
  return platform && id ? `${platform}:${id}` : "";
}

function allPlayers(replay) {
  return [...(replay.blue?.players ?? []), ...(replay.orange?.players ?? [])];
}

function exactRankSubject(replay, cell) {
  const prefix = `${cell.rankGroup} `;
  return allPlayers(replay).find((player) =>
    String(player?.rank?.name ?? "").startsWith(prefix) && playerIdentity(player)) ?? null;
}

function replayUrl(cell) {
  const url = new URL(`${API_ROOT}/replays`);
  url.searchParams.set("playlist", cell.playlist);
  url.searchParams.set("season", cell.seasonFilter);
  url.searchParams.set("min-rank", cell.rankMinFilter);
  url.searchParams.set("max-rank", cell.rankMaxFilter);
  url.searchParams.set("sort-by", "replay-date");
  url.searchParams.set("sort-dir", "desc");
  url.searchParams.set("count", "200");
  return url.toString();
}

function priorIdentities(paths) {
  const result = { replayIds: new Set(), matchGuids: new Set(), hashes: new Set() };
  for (const path of paths) {
    if (!existsSync(path)) throw new Error(`Prior manifest does not exist: ${path}`);
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

function createManifest(outputDirectory, priorManifestPaths) {
  const cells = buildMasterCorpusCells();
  return {
    schemaVersion: SCHEMA_VERSION,
    resumeProtocolVersion: MASTER_CORPUS_RESUME_PROTOCOL,
    planVersion: MASTER_CORPUS_PLAN_VERSION,
    createdAt: timestamp(),
    updatedAt: timestamp(),
    source: {
      provider: "ballchasing.com",
      api: "official",
      seasons: [21, 22, 23],
      purpose: "private_internal_engine_calibration_and_blind_evaluation",
      rightsConclusion: "not_asserted",
      customerData: false,
    },
    policy: {
      exactApprovedCount: 1_000,
      rankRange: "Gold through Grand Champion",
      playlists: ["ranked-duels", "ranked-doubles", "ranked-standard"],
      rankProvenance: "Ballchasing player rank object from the season-scoped replay listing; no inferred rank",
      playerCap: PLAYER_CAP,
      uploaderCap: UPLOADER_CAP,
      rawBinariesInGit: false,
      splitMethod: "Exact stratified 70/15/15 quotas; SHA-256 replay-id order; assigned only after all 45 cells are complete and before detector analysis",
      splitIsolation: "Every attributable player may occur once across the complete corpus, preventing player identity overlap between splits",
      frozenHoldoutUse: "Automated parser compatibility only during acquisition; detector execution and tuning access prohibited",
      challengeUse: "No tuning; release-candidate evaluation only",
      priorManifestPaths,
    },
    privacySalt: randomBytes(32).toString("hex"),
    outputDirectory,
    targets: cells,
    planSummary: masterCorpusPlanSummary(cells),
    discovery: {},
    approved: [],
    exclusions: [],
    exclusionCounts: {},
    excludedReplayIds: [],
    summary: null,
  };
}

function loadManifest(path, outputDirectory, priorManifestPaths) {
  if (!existsSync(path)) return createManifest(outputDirectory, priorManifestPaths);
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  if (manifest.planVersion !== MASTER_CORPUS_PLAN_VERSION
    || !Array.isArray(manifest.approved)
    || !Array.isArray(manifest.exclusions)) {
    throw new Error(`Unsupported master corpus manifest: ${path}`);
  }
  migrateMasterCorpusProgress(manifest, manifest.targets, replayUrl);
  const configuredPrior = (manifest.policy?.priorManifestPaths ?? []).map((path) => resolve(path)).sort();
  if (JSON.stringify(configuredPrior) !== JSON.stringify([...priorManifestPaths].sort())) {
    throw new Error("Prior manifest set differs from the resumable master manifest.");
  }
  return manifest;
}

let lastRequestAt = 0;
async function apiRequest(token, url, { binary = false } = {}) {
  let transientAttempts = 0;
  let rateLimitWaits = 0;
  while (true) {
    const wait = Math.max(0, REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt));
    if (wait) await new Promise((resolvePromise) => setTimeout(resolvePromise, wait));
    lastRequestAt = Date.now();
    let response;
    try {
      response = await fetch(url, { headers: { Authorization: token }, signal: AbortSignal.timeout(60_000) });
    } catch (error) {
      if (transientAttempts >= MAX_RETRIES) throw error;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, Math.min(30_000, 1_000 * (2 ** transientAttempts))));
      transientAttempts += 1;
      continue;
    }
    if (response.ok) return binary ? new Uint8Array(await response.arrayBuffer()) : response.json();
    if (response.status === 429) {
      if (rateLimitWaits >= MAX_RATE_LIMIT_WAITS) throw new Error(`Ballchasing hourly rate limit did not recover for ${new URL(url).pathname}.`);
      const retryAfter = Number(response.headers.get("retry-after"));
      const waitMilliseconds = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(60_000, retryAfter * 1_000) : 60_000;
      rateLimitWaits += 1;
      console.error(`Ballchasing rate limit reached; waiting ${Math.round(waitMilliseconds / 1_000)} seconds (${rateLimitWaits}/${MAX_RATE_LIMIT_WAITS}).`);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, waitMilliseconds));
      continue;
    }
    if (![408, 500, 502, 503, 504].includes(response.status) || transientAttempts >= MAX_RETRIES) {
      const responseText = binary ? "" : String(await response.text()).replace(/\s+/g, " ").slice(0, 240);
      throw new Error(`Ballchasing HTTP ${response.status} for ${new URL(url).pathname}${responseText ? `: ${responseText}` : ""}`);
    }
    const retryAfter = Number(response.headers.get("retry-after"));
    await new Promise((resolvePromise) => setTimeout(resolvePromise,
      Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(60_000, retryAfter * 1_000)
        : Math.min(30_000, 1_000 * (2 ** transientAttempts))));
    transientAttempts += 1;
  }
}

const outputDirectory = resolve(argument("--output", "private-corpus/master-s21-s23-1000"));
const manifestPath = resolve(argument("--manifest", `${outputDirectory}/private-manifest.json`));
const priorManifestPaths = argumentsFor("--prior-manifest").map((path) => resolve(path));
const token = process.env.BALLCHASING_API_TOKEN?.trim();
if (!token) throw new Error("BALLCHASING_API_TOKEN must be supplied as a secret environment variable.");

mkdirSync(resolve(outputDirectory, "approved"), { recursive: true, mode: 0o700 });
const manifest = loadManifest(manifestPath, outputDirectory, priorManifestPaths);
const persist = () => { manifest.updatedAt = timestamp(); atomicJson(manifestPath, manifest); };
persist();
const prior = priorIdentities(priorManifestPaths);
const excludedReplayIds = new Set(manifest.excludedReplayIds ?? []);
const replayIds = new Set([...prior.replayIds, ...excludedReplayIds, ...manifest.approved.flatMap((row) => [row.ballchasingReplayId, row.replayId].filter(Boolean).map((id) => String(id).toLowerCase()))]);
const matchGuids = new Set([...prior.matchGuids, ...manifest.approved.map((row) => String(row.matchGuid).toLowerCase())]);
const checksums = new Set([...prior.hashes, ...manifest.approved.map((row) => String(row.sha256).toLowerCase())]);
const playerFingerprints = new Set(manifest.approved.flatMap((row) => row.playerFingerprints ?? []));
const uploaderCounts = new Map();
for (const row of manifest.approved) if (row.uploaderFingerprint) {
  uploaderCounts.set(row.uploaderFingerprint, (uploaderCounts.get(row.uploaderFingerprint) ?? 0) + 1);
}

const auth = await apiRequest(token, `${API_ROOT}/`);
console.error(`Ballchasing authenticated (${auth?.type ?? "account type unavailable"}); resumable 1,000-replay acquisition starting.`);

for (const cell of manifest.targets) {
  const accepted = () => manifest.approved.filter((row) => row.cellKey === cell.key).length;
  if (accepted() >= cell.target) continue;
  let next = manifest.discovery[cell.key]?.next ?? replayUrl(cell);
  let pagesThisRun = 0;
  while (accepted() < cell.target && next && pagesThisRun < MAX_PAGES_PER_CELL) {
    const page = await apiRequest(token, next);
    pagesThisRun += 1;
    for (const replay of page.list ?? []) {
      if (accepted() >= cell.target) break;
      if (!replay?.id || replayIds.has(String(replay.id).toLowerCase())) continue;
      const candidatePlayers = allPlayers(replay);
      const subject = exactRankSubject(replay, cell);
      const identities = candidatePlayers.map(playerIdentity);
      const candidatePlayerFingerprints = [...new Set(identities.filter(Boolean).map((identity) => fingerprint(identity, manifest.privacySalt)))].sort();
      const uploaderFingerprint = fingerprint(replay.uploader?.steam_id ?? replay.uploader?.id, manifest.privacySalt);
      const reject = (reason, details = null) => {
        const row = { ballchasingReplayId: replay.id, cellKey: cell.key, stage: "candidate", reason, details, excludedAt: timestamp() };
        recordMasterCorpusExclusion(manifest, row, excludedReplayIds);
        replayIds.add(String(replay.id).toLowerCase());
      };
      if (!subject) { reject("exact_rank_subject_missing"); continue; }
      if (Number(replay.season) !== cell.season || replay.season_type !== "free2play") { reject("wrong_season"); continue; }
      if (replay.playlist_id !== cell.playlist || candidatePlayers.length !== cell.playerCount) { reject("wrong_mode_or_player_count"); continue; }
      if (identities.some((identity) => !identity) || candidatePlayerFingerprints.length !== cell.playerCount) { reject("player_identity_incomplete"); continue; }
      if (candidatePlayerFingerprints.some((player) => playerFingerprints.has(player))) { reject("player_cap"); continue; }
      if (uploaderFingerprint && (uploaderCounts.get(uploaderFingerprint) ?? 0) >= UPLOADER_CAP) { reject("uploader_cap"); continue; }
      let bytes;
      try {
        bytes = await apiRequest(token, `${API_ROOT}/replays/${encodeURIComponent(replay.id)}/file`, { binary: true });
      } catch (error) { reject("download_failed", String(error?.message ?? error).slice(0, 240)); continue; }
      if (bytes.byteLength < MINIMUM_REPLAY_BYTES) { reject("file_too_small", bytes.byteLength); continue; }
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      if (checksums.has(sha256)) { reject("duplicate_sha256", sha256); continue; }
      let normalized;
      let parserSubjectResolution = null;
      try {
        const parserIdentities = masterCorpusSubjectParserIdentities(subject, candidatePlayers);
        for (let index = 0; index < parserIdentities.length; index += 1) {
          try {
            normalized = inspectReplay(bytes, parserIdentities[index], cell.rankGroup);
            parserSubjectResolution = index === 0 ? "platform_id" : "unique_ballchasing_roster_name";
            break;
          } catch (error) {
            const canTryUniqueName = error?.code === "subject_player_not_found" && index + 1 < parserIdentities.length;
            if (!canTryUniqueName) throw error;
          }
        }
        if (!normalized) throw new Error("No safe parser subject identity was available.");
      } catch (error) {
        reject("parser_rejected", { code: error?.code ?? "parser_error", message: String(error?.message ?? error).slice(0, 240) });
        continue;
      }
      const matchGuid = String(normalized.metadata?.matchGuid ?? "").trim();
      if (!matchGuid) { reject("match_guid_missing"); continue; }
      if (matchGuids.has(matchGuid.toLowerCase())) { reject("duplicate_match_guid", matchGuid); continue; }
      const expectedMode = { "1v1": "Ranked Duel", "2v2": "Ranked Doubles", "3v3": "Ranked Standard" }[cell.mode];
      if (normalized.mode !== expectedMode) { reject("parser_mode_mismatch", normalized.mode ?? null); continue; }
      const destination = resolve(outputDirectory, "approved", `${replay.id}.replay`);
      const partial = `${destination}.partial`;
      writeFileSync(partial, bytes, { mode: 0o600 });
      renameSync(partial, destination);
      manifest.approved.push({
        cellKey: cell.key,
        ballchasingReplayId: replay.id,
        replayId: replay.rocket_league_id ?? null,
        matchGuid,
        sha256,
        rank: cell.rankGroup,
        rankGroup: cell.rankGroup,
        rankProvenance: {
          source: "ballchasing_player_rank",
          name: subject.rank.name,
          tier: subject.rank.tier,
          division: subject.rank.division,
          subjectPlatform: subject.id.platform,
        },
        mode: cell.mode,
        playlist: replay.playlist_id,
        playerCount: candidatePlayers.length,
        replayDate: replay.date,
        season: replay.season,
        seasonType: replay.season_type,
        gameBuild: normalized.gameVersion ?? null,
        parserResult: {
          status: "passed",
          parser: PARSER_VERSION,
          subjectResolution: parserSubjectResolution,
          performanceMetrics: normalized.metadata?.performanceSnapshot?.metrics?.length ?? 0,
        },
        uploaderFingerprint,
        playerFingerprints: candidatePlayerFingerprints,
        subjectFingerprint: fingerprint(playerIdentity(subject), manifest.privacySalt),
        sizeBytes: bytes.byteLength,
        storagePath: destination,
        split: "pending",
        approvedAt: timestamp(),
      });
      replayIds.add(String(replay.id).toLowerCase());
      if (replay.rocket_league_id) replayIds.add(String(replay.rocket_league_id).toLowerCase());
      matchGuids.add(matchGuid.toLowerCase());
      checksums.add(sha256);
      for (const player of candidatePlayerFingerprints) playerFingerprints.add(player);
      if (uploaderFingerprint) uploaderCounts.set(uploaderFingerprint, (uploaderCounts.get(uploaderFingerprint) ?? 0) + 1);
      persist();
      console.error(`Approved ${manifest.approved.length}/1000 · ${cell.key} ${accepted()}/${cell.target}`);
    }
    next = page.next ?? null;
    manifest.discovery[cell.key] = {
      pages: (manifest.discovery[cell.key]?.pages ?? 0) + 1,
      next,
      lastQueriedAt: timestamp(),
      recoveryReason: null,
    };
    persist();
  }
  if (accepted() < cell.target) console.error(`INCOMPLETE ${cell.key}: ${accepted()}/${cell.target}`);
}

const cellsComplete = manifest.targets.every((cell) =>
  manifest.approved.filter((row) => row.cellKey === cell.key).length === cell.target);
const approvedPlayerFingerprintCount = manifest.approved.reduce((sum, row) => sum + (row.playerFingerprints?.length ?? 0), 0);
const uniqueApprovedPlayers = new Set(manifest.approved.flatMap((row) => row.playerFingerprints ?? [])).size;
const playerIsolationPassed = approvedPlayerFingerprintCount === uniqueApprovedPlayers;
const uploaderCapPassed = [...manifest.approved.reduce((counts, row) => {
  if (row.uploaderFingerprint) counts.set(row.uploaderFingerprint, (counts.get(row.uploaderFingerprint) ?? 0) + 1);
  return counts;
}, new Map()).values()].every((count) => count <= UPLOADER_CAP);
if (manifest.approved.length === 1_000 && cellsComplete && (!playerIsolationPassed || !uploaderCapPassed)) {
  throw new Error("Completed corpus failed player isolation or uploader-cap integrity.");
}
if (manifest.approved.length === 1_000 && cellsComplete) assignMasterCorpusSplits(manifest.approved, manifest.targets);
const splitNames = ["calibration_dev", "challenge", "frozen_blind_holdout", "pending"];
const splitCounts = Object.fromEntries(splitNames.map((split) => [split, manifest.approved.filter((row) => row.split === split).length]));
manifest.summary = {
  approved: manifest.approved.length,
  excluded: Object.values(manifest.exclusionCounts ?? {}).reduce((sum, count) => sum + count, 0),
  exclusionCounts: manifest.exclusionCounts,
  completed: manifest.approved.length === 1_000 && cellsComplete && playerIsolationPassed && uploaderCapPassed,
  integrity: { playerIsolationPassed, uploaderCapPassed },
  splitCounts,
  seasonCounts: Object.fromEntries([21, 22, 23].map((season) => [season, manifest.approved.filter((row) => Number(row.season) === season).length])),
  modeCounts: Object.fromEntries(["1v1", "2v2", "3v3"].map((mode) => [mode, manifest.approved.filter((row) => row.mode === mode).length])),
  rankCounts: Object.fromEntries(["Gold", "Platinum", "Diamond", "Champion", "Grand Champion"].map((rank) => [rank, manifest.approved.filter((row) => row.rankGroup === rank).length])),
  uniqueReplayIds: new Set(manifest.approved.map((row) => row.ballchasingReplayId)).size,
  uniqueMatchGuids: new Set(manifest.approved.map((row) => row.matchGuid)).size,
  uniqueHashes: new Set(manifest.approved.map((row) => row.sha256)).size,
  uniquePlayers: uniqueApprovedPlayers,
  completedAt: manifest.approved.length === 1_000 && cellsComplete && playerIsolationPassed && uploaderCapPassed ? timestamp() : null,
};
persist();
console.error(JSON.stringify(manifest.summary));
if (!manifest.summary.completed
  || splitCounts.calibration_dev !== 700
  || splitCounts.challenge !== 150
  || splitCounts.frozen_blind_holdout !== 150) process.exitCode = 2;
